# 🚀 نشر التطبيق (خطوات بسيطة)

## الطريقة السريعة (بدون Google Drive)

إذا أردت النشر **الآن** بدون Google Drive:

```bash
cd TradeTrackerWeb
npx netlify-cli deploy --prod
```

سيعمل التطبيق بالكامل! البيانات تُحفظ في المتصفح فقط.

---

## إضافة Google Drive (اختياري - 10 دقائق)

لتمكين النسخ الاحتياطي على Google Drive:

### الخطوة 1: إنشاء Google Cloud Project

اذهب إلى هذا الرابط المباشر:
**https://console.cloud.google.com/projectcreate**

- **Project name**: `trade-tracker`
- اضغط **Create**

### الخطوة 2: تفعيل Drive API

افتح هذا الرابط (سيفتح مشروعك تلقائياً):
**https://console.cloud.google.com/apis/library/drive.googleapis.com**

- اضغط **Enable**

### الخطوة 3: إعداد OAuth Consent Screen

افتح:
**https://console.cloud.google.com/apis/credentials/consent**

1. اختر **External** → اضغط **Create**
2. املأ:
   - **App name**: `Trade Tracker`
   - **User support email**: بريدك
   - **Developer contact**: بريدك
3. اضغط **Save and Continue** (3 مرات)
4. في صفحة "Test users":
   - اضغط **+ Add Users**
   - أضف بريدك الإلكتروني
   - اضغط **Save and Continue**
5. اضغط **Back to Dashboard**

### الخطوة 4: إنشاء OAuth Client ID

افتح:
**https://console.cloud.google.com/apis/credentials**

1. اضغط **+ Create Credentials** → **OAuth client ID**
2. **Application type**: `Web application`
3. **Name**: `Trade Tracker Web`
4. **Authorized JavaScript origins**:
   - اضغط **+ Add URI**
   - أضف: `https://YOUR_APP_URL.netlify.app` (رابط تطبيقك بعد النشر)
5. اضغط **Create**
6. **انسخ** Client ID (الطويل الذي ينتهي بـ `.apps.googleusercontent.com`)

### الخطوة 5: تحديث التطبيق

افتح `config.js` وعدّل:

```javascript
GOOGLE_CLIENT_ID: 'الصق-هنا-Client-ID.apps.googleusercontent.com',
```

### الخطوة 6: أعد النشر

```bash
cd TradeTrackerWeb
git add . && git commit -m "Add Google OAuth"
npx netlify-cli deploy --prod
```

---

## ✅ انتهى!

الآن **كل مستخدم**:
1. يفتح التطبيق
2. يضغط "🔐 تسجيل الدخول بجوجل"
3. يختار حساب Google الخاص به
4. يوافق مرة واحدة
5. يبدأ بالنسخ الاحتياطي على **Google Drive الخاص به**

**كل مستخدم → حساب Google الخاص به → Google Drive الخاص به**

لا توجد خطوات يدوية للمستخدمين!

---

## 📝 ملاحظات مهمة

### لماذا تحتاج أنت إلى الإعداد؟
- Google يطلب من **صاحب التطبيق** تسجيل التطبيق
- هذا للأمان (حتى لا يمكن لأي شخص انتحال اسم تطبيقك)
- تفعله **مرة واحدة فقط**

### هل يرى المستخدمون إعدادات معقدة؟
**لا!** فقط:
- شاشة "Sign in with Google" (مثل أي تطبيق)
- شاشة صلاحيات بسيطة: "Trade Tracker wants to access your Google Drive"
- زر "Allow"

### هل البيانات آمنة؟
- كل مستخدم → بياناته في Drive الخاص به فقط
- لا يمكنك أنت رؤية بيانات المستخدمين
- لا يوجد سيرفر وسيط
- البيانات تذهب مباشرة من المتصفح إلى Google Drive

---

## استكشاف الأخطاء

### "Access blocked: This app's request is invalid"
- تأكد من إكمال OAuth Consent Screen
- أضف نفسك كـ Test User

### "Origin mismatch"
- تأكد من إضافة رابط التطبيق الصحيح في Authorized JavaScript origins

### لا يظهر زر Google Drive؟
- تأكد من تحديث `config.js` بالـ Client ID
- تأكد من النشر (لن يعمل على file://)
