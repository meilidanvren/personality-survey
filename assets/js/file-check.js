/**
 * 直接双击 html 文件时（file://），浏览器会拦截 ES 模块，页面只剩空壳。
 * 这个脚本用普通 script 加载，能正常执行，用来给出明确提示。
 */
(function () {
  if (location.protocol !== 'file:') return;

  function show() {
    var tip = document.createElement('div');
    tip.className = 'card';
    tip.innerHTML =
      '<p class="eyebrow">无法加载</p>' +
      '<h2>页面没有正常加载</h2>' +
      '<p class="muted">你可能是直接双击了 html 文件。浏览器出于安全限制，不允许本地文件加载网页脚本，所以题目显示不出来。</p>' +
      '<p>请用下面任意一种方式打开：</p>' +
      '<ul class="facts">' +
      '<li><b>本地</b><span>回到文件夹，双击 start-local.bat，然后用弹出的 http://localhost:8000 访问</span></li>' +
      '<li><b>线上</b><span>部署到 GitHub Pages 后，通过 https://用户名.github.io/仓库名/ 访问</span></li>' +
      '</ul>';

    var host = document.getElementById('app') || document.getElementById('admin');
    if (host) {
      host.innerHTML = '';
      host.appendChild(tip);
      return;
    }
    var main = document.querySelector('main');
    if (main) main.insertBefore(tip, main.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
