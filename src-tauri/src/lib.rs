use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![append_agent_log])
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
