import fs from "fs";
import path from "path";

export function avatarDir() {
  const dir = path.join(process.cwd(), "data", "avatars");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function avatarPath(userId: string) {
  return path.join(avatarDir(), `${userId}.jpg`);
}

export function hasAvatarFile(userId: string) {
  return fs.existsSync(avatarPath(userId));
}
