# استكشاف أخطاء Google Sign-In

## المشكلة: زر تسجيل الدخول لا يفعل شيئاً

### ✅ قائمة التحقق:

#### 1. هل أضفت رابط GitHub Pages إلى Google OAuth؟

**اذهب إلى:** https://console.cloud.google.com/apis/credentials

1. اضغط على OAuth Client ID الخاص بك
2. تحت **Authorized JavaScript origins**، يجب أن ترى:
   - `http://localhost:8080` ✓
   - `https://devcops-xyz.github.io` ← **هذا مهم!**
3. إذا لم يكن موجوداً:
   - اضغط **+ Add URI**
   - أضف: `https://devcops-xyz.github.io`
   - اضغط **Save**
4. انتظر ~30 ثانية للتحديث

#### 2. افتح Developer Console في المتصفح

اضغط `F12` أو `Ctrl+Shift+I` (في Chrome/Firefox)

ابحث عن أخطاء مثل:
- `Not a valid origin for the client`
- `Google API not loaded`
- `idpiframe_initialization_failed`

#### 3. جرب في نافذة Incognito/Private

أحياناً الـ cookies القديمة تسبب مشاكل.

#### 4. تأكد من أن Google Drive API مفعّل

https://console.cloud.google.com/apis/library/drive.googleapis.com

يجب أن ترى "API enabled" ✓

---

## الأخطاء الشائعة وحلولها:

### خطأ: "origin_mismatch"
**الحل:** أضف `https://devcops-xyz.github.io` إلى Authorized JavaScript origins

### خطأ: "popup_closed_by_user"
**الحل:** اسمح للنوافذ المنبثقة في المتصفح

### خطأ: "access_denied"
**الحل:** تأكد من:
- إكمال OAuth Consent Screen
- إضافة نفسك كـ Test User (إذا كان التطبيق في وضع Testing)

### خطأ: "idpiframe_initialization_failed"
**الحل:** مشكلة في third-party cookies - جرب في Chrome أو Firefox

---

## اختبار سريع:

افتح Console في المتصفح واكتب:

```javascript
console.log('Config:', window.APP_CONFIG);
console.log('Google loaded:', typeof google !== 'undefined');
console.log('Google accounts:', typeof google?.accounts !== 'undefined');
```

يجب أن ترى:
- Client ID صحيح
- `Google loaded: true`
- `Google accounts: true`

---

## لا يزال لا يعمل؟

1. افحص Network tab في Developer Tools
2. ابحث عن طلبات لـ `accounts.google.com`
3. افحص Status Code - يجب أن يكون `200 OK`

إذا رأيت `400` أو `403` → مشكلة في OAuth configuration

---

## تواصل معي

أرسل لي:
1. Screenshot من Console errors
2. Screenshot من OAuth credentials في Google Console
3. الرابط الذي تستخدمه
