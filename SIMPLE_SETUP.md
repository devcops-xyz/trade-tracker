# إعداد سريع (5 دقائق فقط!)

## الخطوات

### 1️⃣ إنشاء OAuth Client ID

افتح الرابط التالي وسيتم إنشاء كل شيء تلقائياً:

**👉 https://console.cloud.google.com/apis/credentials/oauthclient**

1. **إذا طُلب منك إنشاء مشروع:**
   - اضغط "Create Project"
   - اكتب اسم: "Trade Tracker"
   - اضغط "Create"

2. **إعداد OAuth Consent Screen (سيظهر تلقائياً):**
   - اختر "External"
   - اضغط "Create"
   - **App name:** Trade Tracker
   - **User support email:** بريدك الإلكتروني
   - **Developer contact:** بريدك الإلكتروني
   - اضغط "Save and Continue"
   - اضغط "Save and Continue" (للأقسام المتبقية)
   - اضغط "Back to Dashboard"

3. **العودة لإنشاء OAuth Client:**
   - اذهب إلى: https://console.cloud.google.com/apis/credentials
   - اضغط "+ Create Credentials" > "OAuth client ID"
   - **Application type:** Web application
   - **Name:** Trade Tracker Web
   - **Authorized JavaScript origins:** أضف:
     ```
     http://localhost:8080
     ```
   - بعد النشر، أضف رابط موقعك (مثال: `https://your-app.netlify.app`)
   - اضغط "Create"
   - **انسخ Client ID** (الذي ينتهي بـ `.apps.googleusercontent.com`)

### 2️⃣ تحديث ملف config.js

افتح ملف `config.js` في المحرر وغيّر السطر:

```javascript
GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
```

الصق الـ Client ID الذي نسخته:

```javascript
GOOGLE_CLIENT_ID: '123456789-abc.apps.googleusercontent.com',
```

احفظ الملف.

### 3️⃣ انتهى! 🎉

الآن عند فتح التطبيق:
- سيظهر زر "🔐 تسجيل الدخول بجوجل"
- المستخدم يضغط عليه
- يختار حساب Google
- يوافق على الصلاحيات
- يستطيع النسخ الاحتياطي والاستعادة فوراً!

---

## للنشر

عند نشر التطبيق على Netlify/Vercel/GitHub Pages:

1. انشر التطبيق أولاً
2. احصل على الرابط (مثال: `https://trade-tracker.netlify.app`)
3. ارجع إلى: https://console.cloud.google.com/apis/credentials
4. اضغط على OAuth Client ID الذي أنشأته
5. أضف رابط موقعك إلى "Authorized JavaScript origins"
6. احفظ

**ملاحظة:** التطبيق لن يعمل على `file://` - يجب النشر على استضافة حقيقية.

---

## اختبار محلي

```bash
cd TradeTrackerWeb
python3 -m http.server 8080
```

افتح: http://localhost:8080

تأكد من إضافة `http://localhost:8080` في Authorized origins!

---

## الأمان ✅

- لا يمكن لأحد استخدام الـ Client ID إلا من الروابط المصرح بها
- البيانات محفوظة في Google Drive الخاص بكل مستخدم فقط
- لا يتم إرسال البيانات لأي خادم آخر
- كل مستخدم يدخل بحسابه الخاص

---

## استكشاف الأخطاء

### لا يظهر زر تسجيل الدخول؟
- تأكد من تحديث `config.js` بالـ Client ID الصحيح

### خطأ: "Origin mismatch"
- أضف رابط موقعك إلى Authorized JavaScript origins

### خطأ: "Access blocked"
- تأكد من إكمال إعداد OAuth Consent Screen
- أضف نفسك كـ Test User إذا كان التطبيق في وضع Testing
