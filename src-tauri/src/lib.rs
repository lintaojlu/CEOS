use std::collections::HashMap;
use std::fs::{self, create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use tauri::ipc::Channel;
use tauri::Manager;

const LLM_BODY_LIMIT: usize = 8 * 1024 * 1024;

fn llm_client() -> &'static reqwest::Client {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  CLIENT.get_or_init(|| {
    reqwest::Client::builder()
      .timeout(std::time::Duration::from_secs(180))
      .build()
      .expect("llm http client")
  })
}

fn llm_network_message(err: reqwest::Error) -> String {
  if err.is_timeout() {
    return "模型服务响应超时".into();
  }
  if err.is_connect() {
    return "连不上模型服务，请检查请求地址和网络".into();
  }
  format!("网络请求失败：{err}")
}

#[derive(serde::Serialize)]
struct LlmHttpResponse {
  status: u16,
  body: String,
}

#[tauri::command]
async fn llm_http(
  method: String,
  url: String,
  headers: HashMap<String, String>,
  body: Option<String>,
) -> Result<LlmHttpResponse, String> {
  let http_method = match method.to_ascii_uppercase().as_str() {
    "GET" => reqwest::Method::GET,
    "POST" => reqwest::Method::POST,
    _ => return Err("只支持读取模型列表和对话请求".into()),
  };
  let parsed = reqwest::Url::parse(&url).map_err(|_| "请求地址无效".to_string())?;
  if parsed.scheme() != "https" && parsed.scheme() != "http" {
    return Err("请求地址只支持 http 和 https".into());
  }
  let mut request = llm_client().request(http_method, parsed);
  for (key, value) in headers {
    request = request.header(key, value);
  }
  if let Some(body) = body {
    request = request.body(body);
  }
  let response = request.send().await.map_err(llm_network_message)?;
  let status = response.status().as_u16();
  let bytes = response.bytes().await.map_err(llm_network_message)?;
  if bytes.len() > LLM_BODY_LIMIT {
    return Err("模型服务返回的内容过大".into());
  }
  Ok(LlmHttpResponse {
    status,
    body: String::from_utf8_lossy(&bytes).into_owned(),
  })
}

struct LlmCancel {
  flag: Arc<AtomicBool>,
  notify: Arc<tokio::sync::Notify>,
}

fn llm_cancels() -> &'static Mutex<HashMap<String, LlmCancel>> {
  static MAP: OnceLock<Mutex<HashMap<String, LlmCancel>>> = OnceLock::new();
  MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, serde::Serialize)]
struct LlmChunk {
  chunk: String,
}

/// 把可能被拆开的 UTF-8 字节留到下一块，避免一个汉字变成替换符。
fn take_utf8(carry: &mut Vec<u8>, chunk: &[u8]) -> String {
  carry.extend_from_slice(chunk);
  match String::from_utf8(std::mem::take(carry)) {
    Ok(text) => text,
    Err(err) => {
      let bytes = err.into_bytes();
      let valid = match std::str::from_utf8(&bytes) {
        Ok(_) => bytes.len(),
        Err(utf8) => utf8.valid_up_to(),
      };
      let text = String::from_utf8_lossy(&bytes[..valid]).into_owned();
      let incomplete = match std::str::from_utf8(&bytes) {
        Err(utf8) if utf8.error_len().is_none() => true,
        _ => false,
      };
      if incomplete {
        carry.extend_from_slice(&bytes[valid..]);
      } else if valid < bytes.len() {
        carry.extend_from_slice(&bytes[valid + 1..]);
      }
      text
    }
  }
}

#[tauri::command]
async fn llm_http_stream(
  id: String,
  method: String,
  url: String,
  headers: HashMap<String, String>,
  body: Option<String>,
  channel: Channel<LlmChunk>,
) -> Result<LlmHttpResponse, String> {
  let http_method = match method.to_ascii_uppercase().as_str() {
    "GET" => reqwest::Method::GET,
    "POST" => reqwest::Method::POST,
    _ => return Err("只支持读取模型列表和对话请求".into()),
  };
  let parsed = reqwest::Url::parse(&url).map_err(|_| "请求地址无效".to_string())?;
  if parsed.scheme() != "https" && parsed.scheme() != "http" {
    return Err("请求地址只支持 http 和 https".into());
  }
  let cancel = LlmCancel {
    flag: Arc::new(AtomicBool::new(false)),
    notify: Arc::new(tokio::sync::Notify::new()),
  };
  {
    let mut map = llm_cancels().lock().map_err(|_| "无法取消请求".to_string())?;
    map.insert(id.clone(), LlmCancel {
      flag: cancel.flag.clone(),
      notify: cancel.notify.clone(),
    });
  }
  let outcome = async {
    let mut request = llm_client().request(http_method, parsed);
    for (key, value) in headers {
      request = request.header(key, value);
    }
    if let Some(body) = body {
      request = request.body(body);
    }
    let mut response = request.send().await.map_err(llm_network_message)?;
    let status = response.status().as_u16();
    let mut total = 0usize;
    let mut carry = Vec::new();
    loop {
      if cancel.flag.load(Ordering::SeqCst) {
        return Err("已停止".into());
      }
      let next = tokio::select! {
        _ = cancel.notify.notified() => return Err("已停止".into()),
        chunk = response.chunk() => chunk,
      };
      let Some(bytes) = next.map_err(llm_network_message)? else { break };
      total += bytes.len();
      if total > LLM_BODY_LIMIT {
        return Err("模型服务返回的内容过大".into());
      }
      let text = take_utf8(&mut carry, &bytes);
      if text.is_empty() { continue; }
      channel.send(LlmChunk { chunk: text }).map_err(|_| "页面已离开".to_string())?;
    }
    if !carry.is_empty() {
      let text = String::from_utf8_lossy(&carry).into_owned();
      if !text.is_empty() {
        channel.send(LlmChunk { chunk: text }).map_err(|_| "页面已离开".to_string())?;
      }
    }
    Ok(LlmHttpResponse { status, body: String::new() })
  }.await;
  if let Ok(mut map) = llm_cancels().lock() {
    map.remove(&id);
  }
  outcome
}

#[tauri::command]
fn llm_http_cancel(id: String) -> Result<(), String> {
  let found = llm_cancels()
    .lock()
    .map_err(|_| "无法取消请求".to_string())?
    .get(&id)
    .map(|cancel| LlmCancel {
      flag: cancel.flag.clone(),
      notify: cancel.notify.clone(),
    });
  if let Some(cancel) = found {
    cancel.flag.store(true, Ordering::SeqCst);
    cancel.notify.notify_one();
  }
  Ok(())
}

fn append_log_line(app: &tauri::AppHandle, name: &str, line: String) -> Result<(), String> {
  let dir = app.path().app_log_dir().map_err(|err| err.to_string())?;
  create_dir_all(&dir).map_err(|err| err.to_string())?;
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(dir.join(name))
    .map_err(|err| err.to_string())?;
  let single = line.replace(['\n', '\r'], " ");
  writeln!(file, "{single}").map_err(|err| err.to_string())?;
  Ok(())
}

#[tauri::command]
fn append_agent_log(app: tauri::AppHandle, line: String) -> Result<(), String> {
  append_log_line(&app, "agent.jsonl", line)
}

#[tauri::command]
fn append_model_log(app: tauri::AppHandle, line: String) -> Result<(), String> {
  append_log_line(&app, "model.jsonl", line)
}

fn agent_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let mut dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
  dir.push("agent");
  create_dir_all(dir.join("sessions")).map_err(|err| err.to_string())?;
  Ok(dir)
}

fn safe_id(id: &str) -> Result<(), String> {
  let ok = !id.is_empty()
    && id.len() <= 80
    && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
  if ok { Ok(()) } else { Err("对话编号无效".into()) }
}

fn session_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
  safe_id(id)?;
  Ok(agent_root(app)?.join("sessions").join(format!("{id}.jsonl")))
}

#[tauri::command]
fn read_agent_index(app: tauri::AppHandle) -> Result<String, String> {
  let path = agent_root(&app)?.join("index.json");
  match fs::read_to_string(path) {
    Ok(text) => Ok(text),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
    Err(err) => Err(err.to_string())
  }
}

#[tauri::command]
fn write_agent_index(app: tauri::AppHandle, body: String) -> Result<(), String> {
  let path = agent_root(&app)?.join("index.json");
  fs::write(path, body).map_err(|err| err.to_string())
}

#[tauri::command]
fn read_agent_session(app: tauri::AppHandle, id: String) -> Result<String, String> {
  let path = session_path(&app, &id)?;
  match fs::read_to_string(path) {
    Ok(text) => Ok(text),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
    Err(err) => Err(err.to_string())
  }
}

#[tauri::command]
fn append_agent_session(app: tauri::AppHandle, id: String, line: String) -> Result<(), String> {
  let path = session_path(&app, &id)?;
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(path)
    .map_err(|err| err.to_string())?;
  let single = line.replace(['\n', '\r'], " ");
  writeln!(file, "{single}").map_err(|err| err.to_string())
}

#[tauri::command]
fn delete_agent_session(app: tauri::AppHandle, id: String) -> Result<(), String> {
  let path = session_path(&app, &id)?;
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(err) => Err(err.to_string())
  }
}

const IDEA_FILE_LIMIT: usize = 32 * 1024 * 1024;

fn ideas_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let mut dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
  dir.push("ideas");
  create_dir_all(&dir).map_err(|err| err.to_string())?;
  Ok(dir)
}

fn safe_idea_id(id: &str) -> Result<(), String> {
  let ok = !id.is_empty()
    && id.len() <= 80
    && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
  if ok { Ok(()) } else { Err("灵感编号无效".into()) }
}

fn idea_file_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
  safe_idea_id(id)?;
  let root = ideas_root(app)?;
  let path = root.join(format!("{id}.json"));
  let parent = path.parent().ok_or_else(|| "灵感编号无效".to_string())?;
  if parent != root.as_path() {
    return Err("灵感编号无效".into());
  }
  Ok(path)
}

#[tauri::command]
fn read_idea_file(app: tauri::AppHandle, id: String) -> Result<String, String> {
  let path = idea_file_path(&app, &id)?;
  match fs::read_to_string(path) {
    Ok(text) => Ok(text),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
    Err(err) => Err(err.to_string())
  }
}

#[tauri::command]
fn write_idea_file(app: tauri::AppHandle, id: String, body: String) -> Result<(), String> {
  if body.len() > IDEA_FILE_LIMIT {
    return Err("灵感文件过大".into());
  }
  let path = idea_file_path(&app, &id)?;
  let value: serde_json::Value = serde_json::from_str(&body).map_err(|_| "灵感内容无效".to_string())?;
  if !value.is_object() {
    return Err("灵感内容无效".into());
  }
  fs::write(path, body).map_err(|err| err.to_string())
}

#[tauri::command]
fn list_idea_files(app: tauri::AppHandle) -> Result<String, String> {
  let root = ideas_root(&app)?;
  let mut docs = Vec::new();
  let entries = fs::read_dir(&root).map_err(|err| err.to_string())?;
  for entry in entries {
    let entry = entry.map_err(|err| err.to_string())?;
    let name = entry.file_name();
    let name = name.to_string_lossy();
    let Some(id) = name.strip_suffix(".json") else { continue };
    if safe_idea_id(id).is_err() { continue; }
    let text = match fs::read_to_string(entry.path()) {
      Ok(text) => text,
      Err(_) => continue
    };
    if text.len() > IDEA_FILE_LIMIT { continue; }
    match serde_json::from_str::<serde_json::Value>(&text) {
      Ok(value) if value.is_object() => docs.push(value),
      _ => continue
    }
  }
  serde_json::to_string(&docs).map_err(|err| err.to_string())
}

#[tauri::command]
fn delete_idea_file(app: tauri::AppHandle, id: String) -> Result<(), String> {
  let path = idea_file_path(&app, &id)?;
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(err) => Err(err.to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      append_agent_log,
      append_model_log,
      llm_http,
      llm_http_stream,
      llm_http_cancel,
      read_agent_index,
      write_agent_index,
      read_agent_session,
      append_agent_session,
      delete_agent_session,
      read_idea_file,
      write_idea_file,
      list_idea_files,
      delete_idea_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
