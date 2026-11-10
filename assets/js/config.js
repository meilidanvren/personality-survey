/**
 * 全站配置。改这里就能改文案、页长、编号规则和数据存放方式。
 * 这个文件不依赖浏览器，Node 测试也能直接引用。
 */
export const CONFIG = {
  studyTitle: '人格特质与信息判断调查',
  studyIntro:
    '本调查分两次进行。第一次约需 20 分钟：完成几组问卷、观看一段短视频并继续作答，结束后会生成一个 16 位编号；第二次凭该编号参加，约需 5 分钟。',
  contact: '如有疑问，请联系主试。',

  // 每页显示几道题（题量大可以调大）
  pageSize: 6,

  code: {
    // 16 位，去掉容易看错的 I、O、0、1
    length: 16,
    charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  },

  flow: {
    // 人格结果不展示给被试，只用于选择视频
    showResultToParticipant: false,
    // 是否必须完整看完视频才能继续
    requireFullVideo: true,
    // 视频加载失败时：'allow' 允许跳过继续（方便还没放视频时测试），'block' 不放行
    videoFallback: 'block',
    // 一测完成后多少天才能进入二测。
    // 正式值 7；只在本地模式测试时可临时改 0（Supabase 模式的等待由数据库判定，改这里无效）。
    // 改这里的同时必须改 supabase/schema.sql 里的 interval '7 days'
    test2DelayDays: 0,
  },

  storage: {
    // 'local'：数据存在被试浏览器里，只适合本地测试 / 当面施测
    // 'supabase'：正式收数据用这个，可跨设备、数据统一留存
    driver: 'local',
    supabase: {
      url: 'https://rsitzpkuzwpxjndflhqd.supabase.co',
      anonKey: 'sb_publishable_kMr9TA6vaYrbYxsaAEgT1A_7zKYaK1V',
    },
  },

  // 管理页（admin.html）的口令。改了记得别把页面链接发给被试。
  adminPass: 'admin1234',
};
