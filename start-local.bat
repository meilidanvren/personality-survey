@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py"
)
if not defined PY (
  echo.
  echo 没有找到 Python。
  echo 你可以先安装 Python（python.org），或者直接把整个文件夹上传到 GitHub Pages。
  echo.
  pause
  exit /b 1
)

echo.
echo 正在启动本地预览服务器...
echo 地址：http://localhost:8000
echo 关闭此窗口即可停止服务。
echo.

start "" /b %PY% -m http.server 8000
timeout /t 2 >nul
start "" http://localhost:8000/
pause
