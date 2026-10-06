fn main() {
  println!("cargo:rerun-if-changed=icons");
  println!("cargo:rerun-if-changed=app-icon.svg");
  tauri_build::build();
}

