# esim 部署到 Railway

## 前置準備

1. 申請 [Railway](https://railway.app) 帳號
2. 安裝 Railway CLI（可選）：`npm i -g @railway/cli`
3. 將 esim 程式碼推到 GitHub 等 Git 倉庫

## 部署步驟

### 1. 建立專案

1. 登入 [Railway Dashboard](https://railway.app/dashboard)
2. 點 **New Project** → 選擇 **Deploy from GitHub repo**
3. 選取 esim 的倉庫並授權

### 2. 新增 Volume（資料庫持久化）

SQLite 需要寫入磁碟，必須搭配 Volume 才不會在重啟時清空資料。

1. 在專案中點選你的服務（Service）
2. 點 **+ New** → **Volume**
3. 建立 Volume，掛載路徑設為：`/app/data`
4. 完成後 Railway 會提供 `RAILWAY_VOLUME_MOUNT_PATH` 環境變數（通常為 `/app/data`）

### 3. 設定環境變數

在 Service 的 **Variables** 分頁新增：

| 變數名稱 | 值 | 說明 |
|---------|---|------|
| `DATABASE_PATH` | `/app/data/dev.db` | SQLite 檔案路徑（需落在 Volume 掛載路徑下） |
| `ADMIN_EMAIL` | `admin` | 管理者帳號 |
| `ADMIN_PASSWORD` | `zz572356` | 管理者密碼（正式環境請改為強密碼） |
| `SESSION_SECRET` | 至少 32 字元的隨機字串 | Session 加密金鑰 |

產生隨機 SESSION_SECRET 範例：
```bash
openssl rand -base64 32
```

### 4. 產生網域

1. 點選 Service → **Settings** → **Networking**
2. 點 **Generate Domain**，取得如 `xxx.up.railway.app` 的網址

### 5. 部署

推送到 GitHub 後，Railway 會自動偵測變更並重新部署。

---

## 網址

- **店家登入**：`https://你的網域/login`
- **管理者登入**：`https://你的網域/admin/login`

---

## 注意事項

- 首次部署後資料庫會自動建立（Store、Esim 表）
- 管理者需先登入 `/admin/login`，在後台建立店家帳號，店家才能用 `/login` 登入
- 若之後改用 PostgreSQL，需修改 `src/lib/db.ts` 與 Prisma 設定
