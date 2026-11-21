<div align="center">
  <img src="build/icon.png" width="120" alt="JixOne">

# JixOne Desktop

**پلیر موسیقی JixOne برای ویندوز، مک و لینوکس**
JixOne music player for Windows, macOS and Linux

[⬇ دانلود · Download](https://github.com/jixa11/jixone-desktop/releases/latest) · [Android](https://github.com/jixa11/JixOne)

</div>

## چیست

همان JixOne اندروید، روی کامپیوتر: کاتالوگ YouTube Music با ظاهر خودش، رایگان و بدون تبلیغ. برنامه خودش مستقیم با یوتیوب حرف می‌زند، پس سرور جداگانه لازم ندارد.

- خانه‌ی شخصی از آرتیست‌هایی که دنبال می‌کنی، به‌همراه ترندها
- جست‌وجو، صفحه‌ی آرتیست با تعداد پخش، آلبوم و پلی‌لیست
- صف، شافل، تکرار، رادیو، کلیدهای مدیا، متن آهنگ همگام
- لایک‌ها و پلی‌لیست‌های خودت، روی همین کامپیوتر
- فارسی و انگلیسی، واکنش‌گرا

## نصب

از [Releases](https://github.com/jixa11/jixone-desktop/releases/latest):

| فایل | برای |
| --- | --- |
| `JixOne-*-Setup.exe` | ویندوز، نصبی |
| `JixOne-*-Portable.exe` | ویندوز، بدون نصب |
| `JixOne-*-mac.dmg` | مک (امضا نشده: بار اول کلیک راست ← Open) |
| `JixOne-*-linux.AppImage` | لینوکس |

اگر آهنگی پخش نشد، از تنظیمات با حساب YouTube Music وارد شو.

## Build

```bash
npm install
npm start          # run
npm run dist       # package for this OS
```

Electron + React. The YouTube engine (youtubei.js, BotGuard tokens via bgutils-js) runs in the main process; audio reaches the window through a `jix://stream/<id>` protocol that proxies the stream in ranged chunks. JixOne hosts no media. GPL-3.0. Icons: [Phosphor](https://phosphoricons.com) (MIT).
