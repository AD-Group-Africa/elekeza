import { execSync } from 'child_process'
import path from 'path'

/**
 * Builds the backend boot JAR before the E2E web servers start, so the
 * Playwright config can launch it with plain java args (reliable on Windows,
 * where Gradle arg quoting and daemon environment capture are unreliable).
 */
export default function globalSetup() {
  const backendDir = path.join(__dirname, '..', '..', 'backend')
  const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'
  console.log('[e2e] building backend boot JAR…')
  execSync(`${gradlew} bootJar --console=plain`, {
    cwd: backendDir,
    stdio: 'inherit',
  })
  console.log('[e2e] backend JAR ready.')
}
