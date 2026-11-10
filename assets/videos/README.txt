视频文件说明（2026-11-11 更新）

本文件夹放研究二的 4 支视频，文件名必须与下面一致（映射写在
assets/js/test1.js 的 VIDEO_BY_GROUP）：

  video-1.mp4      人格匹配 A 版（V-A，高神经质画像）
  video-2.mp4      人格匹配 B 版（V-B，低尽责性画像）
  video-3.mp4      通用视频（V-C）
  video-4.mp4      中性视频（V-N）

文件名故意用中性编号，避免被试从地址栏或开发者工具里猜到自己的类型。
不要把 V-A／V-B 这类原始名传到线上。

当前文件（2026-11-11 压缩后，原始 8 Mbps 版留在 E:\论文初稿\短视频\）：
  video-1.mp4  19.5 MB  1280×720  30fps  H.264 + AAC  68.3s
  video-2.mp4  19.4 MB  1280×720  30fps  H.264 + AAC  68.3s
  video-3.mp4  19.4 MB  1280×720  30fps  H.264 + AAC  68.2s
  video-4.mp4  25.8 MB  1280×720  30fps  H.264 + AAC  67.8s

压缩参数：libx264 CRF 21、-tune animation、preset medium、AAC 128k、
+faststart（moov 前置，边下边播）。与原片 SSIM ≈ 0.9935，肉眼几乎无差异；
四支合计 84 MB（压缩前 263 MB）。

注意：
- config.js 的 flow.videoFallback 已设为 'block'：视频加载失败时被试不能跳过，
  页面只提示“请联系主试”。现场需能处理播放故障，否则被试会卡住。
- config.js 的 flow.requireFullVideo 为 true：必须播放到结尾才解锁下一页。
- 若替换视频，保持 1280×720 / H.264 / AAC / mp4，并重新跑一遍上面的压缩参数。
