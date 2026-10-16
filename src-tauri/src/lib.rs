use std::fs::{self, create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use tauri::Manager;

#[tauri::command]
fn append_agent_log(app: tauri::AppHandle, line: String) -> Result<(), String> {
  let dir = app.path().app_log_dir().map_err(|err| err.to_string())?;
  create_dir_all(&dir).map_err(|err| err.to_string())?;
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(dir.join("agent.jsonl"))
    .map_err(|err| err.to_string())?;
  let single = line.replace(['\n', '\r'], " ");
  writeln!(file, "{single}").map_err(|err| err.to_string())?;
  Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      append_agent_log,
      read_agent_index,
      write_agent_index,
      read_agent_session,
      append_agent_session,
      delete_agent_session
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
