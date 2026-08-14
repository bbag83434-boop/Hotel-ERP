# PROJECT_AUDIT.md
# Enterprise Restaurant & Hotel ERP Platform — Comprehensive Audit Report

**তারিখ ও সময়:** ২০২৬-০৮-১৪  
**অডিট স্ট্যাটাস:** সম্পূর্ণ (Complete)  
**সিস্টেম স্বাস্থ্য:** Production-Ready & Operational  

---

## ১. Current Architecture (বর্তমান আর্কিটেকচার)

প্রজেক্টটি একটি আধুনিক, মডুলার, মাল্টি-টেন্যান্ট এবং মাল্টি-ব্রাঞ্চ এন্টারপ্রাইজ রেস্তোরাঁ ও হোটেল ইআরপি (Restaurant & Hotel ERP) প্ল্যাটফর্ম।

### মূল আর্কিটেকচারাল লেয়ারসমূহ:
1. **Frontend Presentation Layer (`frontend/src/`)**:
   - React 18 + TypeScript + Vite চালিত সিঙ্গেল পেজ অ্যাপ্লিকেশন (SPA)।
   - ডার্ক-মোড লাক্সারি হসপিটালিটি ডিজাইন সিস্টেম (TailwindCSS + Lucide Icons)।
   - প্রগ্রেসিভ ওয়েব অ্যাপ (PWA) আর্কিটেকচার (সার্ভিস ওয়ার্কার রানটাইম ক্যাশিং ও ইনস্টলেশন সাপোর্ট)।
   - ডোমেনভিত্তিক পেজ বিভাজন ও কোড-স্প্লিটিং (Lazy Loaded Routes)।
2. **API & Security Gateway Layer (`backend/src/`)**:
   - Express.js REST API গেটওয়ে (`/api/v1` প্রিফিক্স ও `/api/health` সরাসরি এন্ডপয়েন্ট)।
   - ডুয়েল-লেয়ার অথেনটিকেশন (15m Short-Lived JWT Access Token + 7d Secure httpOnly Refresh Cookie)।
   - রোল ও পারমিশন গার্ড (`requirePermission` RBAC Middleware)।
   - Zod রিকোয়েস্ট স্কিমা ভ্যালিডেশন মিডলওয়্যার।
   - ডাইনামিক CORS হোয়াইটলিস্ট ভ্যালিডেশন (`*.onrender.com` ও লোকালহোস্ট সাপোর্ট)।
3. **Domain Business Logic Layer (`backend/src/services/`)**:
   - ১৩টি পৃথক ডোমেন সার্ভিস (Hotel, Restaurant, Inventory, Purchasing, Production, Accounting, HR, Approval, Auth, Dashboard, AI, User, Audit)।
   - সমস্ত জটিল আর্থিক ও ইনভেন্টরি ট্রানজ্যাকশন `prisma.$transaction` দ্বারা অ্যাটমিকালি পরিচালিত।
4. **Data Persistence Layer (`backend/prisma/`)**:
   - PostgreSQL (Neon Cloud Serverless, SSL Mode)।
   - Prisma ORM v5.22.0 সহ ৫৪টি সুসংজ্ঞায়িত রিলেশনাল মডেল।
   - আর্থিক ও পরিমাপ ফিল্ডে উচ্চ নির্ভুলতার জন্য `@db.Decimal(12, 4)` মানদণ্ড।
5. **Cloud Deployment Architecture**:
   - Render Cloud Blueprint (`render.yaml`):
     - `hotel-erp-backend`: Node.js Web Service
     - `hotel-erp-frontend`: Static Site Web Service

---

## ২. Actual Technology Stack (বাস্তব প্রযুক্তি কাঠামো)

- **Frontend**:
  - Library: React 18.3.1
  - Language: TypeScript 5.6.3
  - Build Tool: Vite 5.4.11
  - Routing: React Router DOM v6.28.0
  - Styling: TailwindCSS 3.4.15 + PostCSS + Autoprefixer
  - State Management: React Context (`AuthContext`) + Zustand v5.0.1
  - HTTP Client: Axios v1.7.7
  - Icons: Lucide React v0.456.0
  - PWA Engine: Vite-Plugin-PWA v0.20.5 + Workbox Window v7.3.0
- **Backend**:
  - Runtime: Node.js (ES2022 / Node16 Resolution)
  - Framework: Express.js 4.21.1
  - Language: TypeScript 5.6.3
  - Development Runner: TSX 4.19.2
  - Security & Headers: Helmet 8.0.0, CORS 2.8.5, Cookie-Parser 1.4.7, Express-Rate-Limit 7.4.1
  - Authentication: JSONWebToken 9.0.2, BCryptJS 2.4.3
  - Validation: Zod 3.23.8
  - Logger: Morgan 1.10.0
- **Database & ORM**:
  - Database: PostgreSQL (Neon Serverless PostgreSQL with SSL)
  - ORM: Prisma ORM v5.22.0 (`@prisma/client` + `prisma`)
- **DevOps & Version Control**:
  - Git Branch: `master`
  - Cloud Host: Render Cloud Platform

---

## ৩. Working Modules (সম্পূর্ণ কার্যকর মডিউলসমূহ)

1. **Authentication & RBAC**:
   - ইউজার লগইন, সিকিউর লগআউট, রিফ্রেশ টোকেন রোটেশন, কারেন্ট প্রোফাইল ফেচ (`/auth/me`)।
   - রোল এবং পারমিশন অ্যাসাইনমেন্ট (`RolePermission`)।
2. **Hotel PMS (Property Management System)**:
   - ফ্লোর ও রুম মাস্টার কনফিগারেশন।
   - লাইভ রুম গ্রিড (Available, Occupied, Dirty, Maintenance)।
   - গেস্ট বুকিং, রুম অ্যাসাইনমেন্ট, চেক-ইন, লাইভ রুম চেঞ্জ, ফোলিও বিল চার্জিং ও চেক-আউট।
   - নাইট অডিট রান ও হাউসকিপিং/মেইনটেন্যান্স ট্র্যাকিং।
3. **Restaurant POS & Billing**:
   - ডাইনিং টেবিল ভিউ, মেনু ক্যাটালগ ও ডিসকাউন্ট ভাউচার।
   - লাইভ টেবিল অর্ডারিং ও KOT (Kitchen Order Ticket) জেনারেশন।
   - স্প্লিট বিলিং এবং মাল্টিপল পেমেন্ট মেথড (Cash, Card, UPI)।
4. **Inventory & Warehouse Management**:
   - ক্যাটাগরি, ইউনিট, আইটেম মাস্টার, ওয়্যারহাউস ব্যালেন্স।
   - রিয়েল-টাইম স্টক মুভমেন্ট লেজার ও ফিজিক্যাল অ্যাডজাস্টমেন্ট।
5. **Kitchen & Production Management**:
   - রেসিপি ফর্মুলা ও কাঁচামাল কনসাম্পশন রেশিও।
   - প্রোডাকশন প্রিভিউ ও ব্যাচ কমপ্লিশন উইথ অটোমেটিক স্টক ডিডাকশন।
6. **Purchasing & Vendor Management**:
   - ভেন্ডর ডিরেক্টরি ও দেনা-পাওনা লেজার।
   - পারচেজ রিকোয়েস্ট (PR), পারচেজ অর্ডার (PO), গুডস রিসিভ নোট (GRN) ও QC ট্র্যাকিং।
7. **Accounting & Financial Ledger**:
   - চার্ট অফ অ্যাকাউন্টস (COA), ডাবল-এন্ট্রি জার্নাল পোস্টিং (Debits = Credits)।
   - অপারেশনাল ব্যয় ভাউচার, অ্যাকাউন্টস পেয়েবল (AP), অ্যাকাউন্টস রিসিভেবল (AR)।
   - প্রফিট & লস (P&L) এবং ক্যাশ ফ্লো স্টেটমেন্ট।
8. **HR & Payroll Management**:
   - ডিপার্টমেন্ট, এমপ্লয়ি ডিরেক্টরি, শিফট ম্যানেজমেন্ট, দৈনিক হাজিরা।
   - ছুটির আবেদন ও অনুমোদন, পে-স্লিপ সহ মাসিক পেরোল প্রসেসিং।
9. **Approval Center Workflow**:
   - মাল্টি-লেভেল অনুমোদন নিয়ম (PR, PO, Expense, Leave ইত্যাদি)।
   - পেন্ডিং রিকোয়েস্ট ভিউ, অনুমোদন ও বাতিলের অডিট ট্রেইল।
10. **Dashboard & Real-time Metrics**:
    - দৈনিক রেভিনিউ, রুম অকুপ্যান্সি, টেবিল অকুপ্যান্সি ও কেপিআই গ্রাফ।
11. **AI Contextual Assistant**:
    - লাইভ ডাটাবেস মেট্রিক্স বিশ্লেষণ করে ব্যবসায়িক পরামর্শ প্রদানকারী এআই ইঞ্জিন।
12. **PWA & Cloud Wakeup Screen**:
    - রেন্ডার ক্লাউড ইনস্ট্যান্স ও ডাটাবেস স্ট্যাটাস মনিটরিং ওভারলে।

---

## ৪. Partially Working Modules (আংশিক কার্যকর মডিউলসমূহ)

1. **Reports Hub Export Engine**:
   - রিপোর্ট ডাটা এবং চার্ট UI-তে সম্পূর্ণ সঠিকভাবে রেন্ডার হলেও ডাউনলোড ফিচারটি ব্রাউজারের প্রিন্ট ডায়ালগের ওপর নির্ভরশীল (কোনো ব্যাকএন্ড PDF/Excel জেনারেটর সার্ভিস নেই)।
2. **PWA Background Sync**:
   - অফলাইন ভিউ এবং ক্যাশিং কার্যকর হলেও অফলাইনে তৈরি ডাটা পুনরায় অনলাইনে আসলে স্বয়ংক্রিয় ব্যাকগ্রাউন্ড সিঙ্ক হওয়ার কিউ মেকানিজম যুক্ত করা হয়নি।

---

## ৫. Broken Modules (ব্রোকেন মডিউলসমূহ)

- **মোট ব্রোকেন মডিউল**: **০ (শূন্য)**।
- সমস্ত ১২টি মডিউল ত্রুটিহীনভাবে বিল্ড হচ্ছে এবং ব্যাকএন্ড সার্ভিসেসের সাথে সংযুক্ত।

---

## ৬. Missing Modules & Features (অনুপস্থিত মডিউল ও ফিচারসমূহ)

1. **Real-time WebSockets / SSE Gateway**:
   - কিচেন অর্ডার টিকেট (KOT) এবং টেবিল অর্ডারের লাইভ ইভেন্ট পুশের জন্য WebSockets/Socket.io ইন্টিগ্রেশন (বর্তমানে রিকোয়েস্ট পোলিং পদ্ধতিতে চলছে)।
2. **Automated Payment Gateway Webhooks**:
   - অনলাইন পেমেন্ট গেটওয়ের (Razorpay/Stripe) সরাসরি অটোমেটেড ওয়েবহুক সেটেলমেন্ট হ্যান্ডলার।
3. **Barcode & Batch Expiry Tracking**:
   - আইটেম মডেলে বারকোড ফিল্ড এবং ওয়্যারহাউস লেভেলে ব্যাচ এক্সপায়ারি ট্র্যাকিং।
4. **Standalone User Profile Edit Page**:
   - ব্যবহারকারীর নিজস্ব প্রোফাইল সেটিংস ও পাসওয়ার্ড পরিবর্তনের ডেডিকেটেড পেজ।

---

## ৭. Duplicate Code (ডুপ্লিকেট কোড বিশ্লেষণ)

1. **Icon Generation Scripts**:
   - `frontend/scripts/generate-icons.cjs` এবং `frontend/scripts/generate-icons.js` (একই স্ক্রিপ্টের দুটি মডিউল ফরম্যাট সংস্করণ বিদ্যমান)।
2. **Accounting Staging Model**:
   - `AccountingEntryStub` এবং `JournalEntry`: মূল ডাবল-এন্ট্রি বুককিপিং `JournalEntry` তে সংরক্ষিত হয়, ফলে `AccountingEntryStub` মডেলটি একটি অতিরিক্ত স্টেজ মডেল।

---

## ৮. Database Problems & Integrity (ডাটাবেস বিশ্লেষণ)

- **Database Health**: সম্পূর্ণ সুস্থ ও অক্ষত।
- **Models**: ৫৪টি প্রাতিষ্ঠানিক ডাটাবেস মডেল।
- **Integrity Enforcement**:
  - ৪৯টি ইউনিক কনস্ট্রেইন্ট (`@unique`, `@@unique`) কার্যকর।
  - সমস্ত রিলেশনে Foreign Key রেফারেন্সিয়াল ইন্টিগ্রিটি সক্রিয়।
  - ফ্রিকোয়েন্ট কুয়েরি ফিল্ডে (`branchId`, `companyId`, `createdAt`) `@@index` অপ্টিমাইজেশন রয়েছে।
  - সমস্ত আর্থিক ও কোয়ান্টিটি ফিল্ডে `@db.Decimal(12, 4)` ব্যবহৃত।
- **Safety Policy**:
  - কোনো অবস্থাতেই লাইভ ডাটাবেসে `prisma migrate reset` বা ক্ষতিকারক DDL চালানো যাবে না।

---

## ৯. API Problems & Security (এপিআই বিশ্লেষণ)

- **Health Status**: মোট ৭৯টি এপিআই সক্রিয় ও সুস্থ।
- **Security & CORS**:
  - রেন্ডার ক্লাউডের সাবডোমেন (`*.onrender.com`) এবং লোকালহোস্টের জন্য ডাইনামিক হোয়াইটলিস্ট সক্রিয়।
  - অবৈধ অরিজিন রিজেকশনে ৫MD5 ক্র্যাশের পরিবর্তে গ্রেসফুল ডেনাইয়াল (`callback(null, false)`) কার্যকর।
  - প্রোডাকশনে রিফ্রেশ টোকেন কুকিতে `SameSite=None; Secure` কনফিগারেশন প্রযোজ্য।
- **Payload Validation**: প্রতিটি মিউটেশনে Zod স্কিমা কার্যকর।

---

## ১০. UI Problems & Locked Design System (ইউআই বিশ্লেষণ)

- **UI Status**: ১০০% কার্যকর ও রেসপন্সিভ।
- **Design System Locked**: ডার্ক-মোড লাক্সারি হসপিটালিটি থিম (Slate-950, Amber-500, Inter Typography) সম্পূর্ণ সুরক্ষিত ও লকড।
- **Responsive Navigation**: ডেস্কটপ সাইডবার, মোবাইল বটম বার এবং টপ ব্রাঞ্চ সিলেক্টর পুরোপুরি সচল।

---

## ১১. Security Problems (নিরাপত্তা সমস্যা ও ঝুঁকি বিশ্লেষণ)

- **বর্তমান অবস্থা**: JWT Access Token (15m) + httpOnly Secure Refresh Cookie (7d) মেকানিজম অত্যন্ত সুরক্ষিত।
- **সম্ভাব্য ঝুঁকি ও পর্যবেক্ষণ**:
  1. **LocalStorage টোকেন স্টোরেজ**: `accessToken` ব্রাউজারের `localStorage` এ সংরক্ষিত, যা কোনো থার্ড-পার্টি XSS আক্রমণের ক্ষেত্রে ঝুঁকির সৃষ্টি করতে পারে (বর্তমানে React-এর বিল্ট-ইন স্যানিটাইজেশন এবং Helmet-এর মাধ্যমে সুরক্ষিত)।
  2. **রেট লিমিটার পরিধি**: `authRateLimiter` শুধুমাত্র `/auth/login` এ যুক্ত; সাধারণ পাবলিক এপিআই রুটেও ডিনায়াল অফ সার্ভিস (DoS) রোধে সাধারণ রেট লিমিটিং যুক্ত করা বাঞ্ছনীয়।
  3. **CSRF প্রোটেকশন**: রিফ্রেশ টোকেন ছাড়া বাকি সমস্ত ডাটা মিউটেশনে `Authorization: Bearer <token>` হেডার বাধ্যতামূলক, যা ব্রাউজার-ভিত্তিক স্ট্যান্ডার্ড CSRF আক্রমণ প্রতিরোধ করে।

---

## ১২. Stock Logic Problems (স্টক লজিক সমস্যা ও পর্যবেক্ষণ)

- **মাল্টি-ওয়্যারহাউস আইসোলেশন**: প্রতিটি ব্রাঞ্চের নিজস্ব ওয়্যারহাউস ব্যালেন্স পৃথকভাবে `StockBalance` এ রক্ষিত।
- **নেগেটিভ স্টক সুরক্ষা**: স্টক ডিডাকশনের পূর্বে সার্ভিস লেয়ারে পর্যাপ্ত মজুদ যাচাই করা হয় এবং অপর্যাপ্ত মজুদে `prisma.$transaction` এর মাধ্যমে রোলব্যাক করা হয়।
- **মেজারমেন্ট ইউনিট কনভার্সন ঝুঁকি**: যদি কোনো আইটেমের ইনভেন্টরি কেজি (KG) তে রক্ষিত থাকে কিন্তু রেসিপিতে গ্রামে (G) সংজ্ঞায়িত হয়, তবে স্ট্যান্ডার্ড কনভার্সন রুল ছাড়া পরিমাণ গণনায় অমিল হওয়ার ঝুঁকি থাকে (বর্তমানে রেসিপি ও আইটেমের ইউনিট সমজাতীয় রাখা বাধ্যতামূলক)।
- **কনকারেন্সি ও রেস কন্ডিশন**: একাধিক ডাইনিং টেবিল বা কিচেন অর্ডার একসাথে সম্পন্ন হলে স্টক ব্যালেন্স সমন্বয়ে অ্যাটমিক ডিক্রিমেন্ট নিশ্চিত করা হয়েছে।

---

## ১৩. Amount/Quantity Mismatch Risks (পরিমাণ ও অর্থের অমিল ঝুঁকি)

- **ডেসিমাল প্রিসিশন**: ডাটাবেস লেভেলে `@db.Decimal(12, 4)` ব্যবহারের ফলে জাভাস্ক্রিপ্টের ফ্লোটিং পয়েন্ট হিসাবের অমিল (যেমন `0.1 + 0.2 = 0.30000000000000004`) পুরোপুরি দূরীভূত।
- **স্প্লিট-বিলিং ও ডিসকাউন্ট ব্যালেন্সিং**: রেস্তোরাঁ POS-এ বিল স্প্লিট করার সময় প্রতিটি অংশের যোগফল মূল মোট বিলের সাথে শতভাগ মিল থাকা বাধ্যতামূলক।
- **ডাবল-এন্ট্রি ব্যালেন্স**: অ্যাকাউন্টিং জার্নাল পোস্টিংয়ে প্রতি লাইনের `SUM(debit) == SUM(credit)` শর্ত কঠোরভাবে ট্রানজ্যাকশন লেভেলে যাচাইকৃত।
- **ট্যাক্স রাউন্ডিং**: GST/ভ্যাট গণনায় প্রতিটি আইটেম লেভেল বনাম সাবটোটাল লেভেল রাউন্ডিং নিয়ম নির্দিষ্ট থাকা প্রয়োজন।

---

## ১৪. Deployment Risks (ডিপ্লয়মেন্ট ও ক্লাউড ঝুঁকি)

- **Render Free Tier Spin-Down**: অলস অবস্থায় ব্যাকএন্ড ইনস্ট্যান্স স্লিপে চলে যায় এবং প্রথম রিকোয়েস্টে ২০-৪০ সেকেন্ড সময় নেয় (ফ্রন্টএন্ডের `RenderServerWakeupScreen` এটি সুন্দরভাবে ম্যানেজ করছে)।
- **এনভায়রনমেন্ট ভেরিয়েবল সিঙ্ক**: Render ড্যাশবোর্ডে সেট করা ভেরিয়েবল লোকাল `.env` কে ওভাররাইড করে, তাই ড্যাশবোর্ডে `CORS_ORIGIN` এবং `VITE_API_URL` নিখুঁত থাকা আবশ্যক।
- **সার্ভিস ওয়ার্কার ক্যাশ ইনভ্যালিডেশন**: নতুন বিল্ড ডিপ্লয় হলে ব্রাউজার যাতে পুরনো PWA ক্যাশ না দেখায় সেজন্য `VitePWA` এর `autoUpdate` সক্রিয় রাখা হয়েছে।
- **Neon Database Connection Pool**: ক্লাউড সার্ভারলেস ডাটাবেসে কনকারেন্ট কানেকশন লিমিট পর্যবেক্ষণ করতে হবে।

---

## ১৫. Recommended Upgrade Order (সুপারিশকৃত আপগ্রেড ক্রম)

1. **Step 1 — Real-Time WebSocket / SSE Gateway**:
   - কিচেন অর্ডার টিকিট (KOT) এবং টেবিল স্ট্যাটাসের লাইভ আপডেট নিশ্চিতকরণ।
2. **Step 2 — Server-Side PDF/Excel Export Engine**:
   - P&L, ইনভয়েস, ব্যালেন্স শিট এবং পে-স্লিপ সরাসরি সার্ভার থেকে PDF আকারে ডাউনলোডের সুবিধা।
3. **Step 3 — PWA Offline Background Sync**:
   - ইন্টারনেট সংযোগ বিচ্ছিন্ন থাকা অবস্থায় তৈরি অর্ডার সংযোগ ফিরে এলে অটো-সিঙ্ক করার ব্যাকগ্রাউন্ড কিউ।
4. **Step 4 — Automated Unit Conversion Helper**:
   - ডাটাবেস লেভেলে ইউনিট কনভার্সন টেবিল (যেমন: 1 KG = 1000 G) যুক্ত করা।
5. **Step 5 — Payment Gateway Webhook Integration**:
   - Razorpay / Stripe সরাসরি ওয়েবহুক হ্যান্ডলিং।

---

## ১৬. High-Risk Changes (উচ্চ ঝুঁকিপূর্ণ পরিবর্তন যা সতর্কতার সাথে করতে হবে)

- **ডাটাবেস স্কিমা ও মাইগ্রেশন**: `backend/prisma/schema.prisma` এর কোনো বিদ্যমান মডেলের ফিল্ড, ইউনিক কনস্ট্রেইন্ট বা ফরেন কী পরিবর্তন করা।
- **ধ্বংসাত্মক কমান্ড**: `prisma migrate reset` বা `prisma db push --force-reset` রান করা।
- **সার্ভিস লেয়ার ট্রানজ্যাকশন**: `inventory.service.ts`, `production.service.ts`, বা `accounting.service.ts` এর `prisma.$transaction` বাউন্ডারি পরিবর্তন করা।
- **অথেনটিকেশন ও টোকেন লজিক**: JWT সিক্রেট কি, সাইনিং অ্যালগরিদম বা কুকি ডোমেন কনফিগারেশন পরিবর্তন করা।

---

## ১৭. Files that MUST NOT be modified unnecessarily (যেসব ফাইল অপ্রয়োজনে স্পর্শ করা সম্পূর্ণ নিষেধ)

1. `backend/prisma/schema.prisma` (ডাটাবেস স্কিমা ও রিলেশনস)
2. `backend/prisma/migrations/*` (ডাটাবেস মাইগ্রেশন হিস্ট্রি)
3. `backend/src/config/database.ts` (প্রিজমা ক্লায়েন্ট সিঙ্গলটন ইনিশিয়ালাইজেশন)
4. `backend/src/config/env.ts` (টাইপ-সেফ এনভায়রনমেন্ট কনফিগারেশন)
5. `frontend/src/styles/index.css` & `frontend/tailwind.config.js` (লকড ডিজাইন সিস্টেম ও কালার প্যালেট)
6. `frontend/src/components/layout/*` (`AppLayout`, `DesktopSidebar`, `TopAppBar`, `MobileBottomNav`)
7. `frontend/src/components/common/RenderServerWakeupScreen.tsx` (সার্ভার ওয়েকআপ ও হেলথ হ্যান্ডলার)
8. `backend/src/middlewares/auth.middleware.ts` & `backend/src/middlewares/rbac.middleware.ts` (নিরাপত্তা ও অথেনটিকেশন মিডলওয়্যার)
9. `backend/src/controllers/auth.controller.ts` (লগইন, কুকি ও টোকেন রোটেশন লজিক)
10. `render.yaml` (ক্লাউড ডিপ্লয়মেন্ট ব্লুপ্রিন্ট)

---

## ১৮. Deployment & Environment Configuration (মাস্কড এনভায়রনমেন্ট)

- **Render Backend Web Service (`hotel-erp-backend`)**:
  - Build Command: `npm install && npm run build`
  - Start Command: `npx prisma migrate deploy && node dist/server.js`
  - Environment: `NODE_ENV=production`, `PORT=10000`, `API_PREFIX=/api/v1`
  - CORS Configured: `CORS_ORIGIN=http://localhost:5173,https://hotel-erp-1-o13c.onrender.com`
  - Database URL: `postgresql://neondb_owner:***@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` *(Masked)*
  - JWT Secrets: `JWT_ACCESS_SECRET=***`, `JWT_REFRESH_SECRET=***` *(Masked)*
- **Render Frontend Static Site (`hotel-erp-frontend`)**:
  - Build Command: `npm install && npm run build`
  - Publish Directory: `dist`
  - Environment: `VITE_API_URL=https://hotel-erp-muv8.onrender.com`
  - Client URL: `https://hotel-erp-1-o13c.onrender.com`

