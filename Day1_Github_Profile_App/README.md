# 🔴 GitHub Profiles

> A sleek, dark-themed GitHub profile search application built with **vanilla HTML, CSS, and JavaScript**. No frameworks. No dependencies. Just a fast, lightweight interface powered by the **GitHub REST API**.

![App Screenshot](https://cdn.corenexis.com/f/8f4mLUYc9p4.jpeg)

---

## ✨ Features

| Feature                          | Description                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| 🔍 **Live Debounced Search**     | Search as you type with a 450 ms debounce to reduce unnecessary API requests.                    |
| ⚡ **Parallel Fetching**          | Fetches profile and repository data concurrently using `Promise.all()`.                          |
| 💾 **Two-Layer Cache**           | Uses an in-memory cache and `localStorage` cache with a 1-hour TTL.                              |
| 🔑 **GitHub Token Support**      | Increases the authenticated API rate limit from 60 to up to 5,000 requests per hour.             |
| 📊 **API Rate-Limit Badge**      | Displays the current number of remaining GitHub API requests.                                    |
| 🛡️ **XSS Protection**           | Sanitises user-supplied content through `escapeHtml()` before rendering.                         |
| 🚦 **Race-Condition Protection** | Uses `AbortController` and request IDs to prevent stale requests from overwriting newer results. |
| ⌨️ **Keyboard Shortcuts**        | Press `/` to focus the search field and `Escape` to blur it.                                     |
| 🖱️ **Animated Custom Cursor**   | Includes a smooth lag-follow cursor ring and precision dot.                                      |
| 📱 **Responsive Design**         | Designed to work across mobile, tablet, and desktop screen sizes.                                |

---

## 🗂️ Project Structure

```text
Day1_Profile_App/
├── index.html        # Semantic application shell
├── custom.css        # Design tokens and component styles
└── app.js            # API requests, caching, rendering, and events
```

---

## 🚀 Getting Started

### Prerequisites

No build tools, package managers, or external dependencies are required.

This is a **pure client-side application** that runs directly in the browser.

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/Day1_Profile_App.git

# Navigate into the project
cd Day1_Profile_App

# Open index.html with VS Code Live Server
# Or simply double-click index.html
```

> **Tip:** For the best development experience, use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension for VS Code.

---

## 🔑 GitHub Token Support

A GitHub API request without authentication is limited to **60 requests per hour**. An authenticated request can provide a substantially higher rate limit, commonly up to **5,000 requests per hour**.

Adding a token is optional but recommended if you plan to search frequently.

### Setup

1. Open [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens).
2. Generate a Personal Access Token for accessing public GitHub data.
3. No repository permissions are required for basic public-data requests.
4. Open the application and select the **🔑 Token** option.
5. Paste your token into the application.

> **Security Note:** Browser-side `localStorage` is **not a secure secret store**. Anyone with access to the browser profile or developer tools may be able to retrieve a token stored there. For production applications, use a secure backend or server-side proxy instead.

---

## ⚙️ Configuration

The main configuration values are defined near the top of `app.js`:

```js
const API_URL   = 'https://api.github.com/users/'; // GitHub REST API base URL
const MAX_REPOS = 6;                                // Maximum repositories displayed
const CACHE_TTL = 1000 * 60 * 60;                  // Cache lifetime: 1 hour
const DEBOUNCE  = 450;                              // Search debounce delay: 450 ms
```

These constants make it easy to adjust the application's API behavior and search experience.

---

## 🎨 Design System

The interface follows a **Black × White × Red** visual system defined through CSS custom properties in `custom.css`.

| Token          | Value                 | Usage                                    |
| -------------- | --------------------- | ---------------------------------------- |
| `--red`        | `#ff2b3d`             | Primary accent, headings, and highlights |
| `--surface`    | `#111111`             | Cards and elevated surfaces              |
| `--text`       | `#f5f5f5`             | Primary text                             |
| `--text-muted` | `#9a9a9a`             | Secondary and supporting text            |
| `--shadow-red` | `rgba(255,43,61,.35)` | Accent glow and visual effects           |

---

## ⌨️ Keyboard Shortcuts

| Key      | Action                           |
| -------- | -------------------------------- |
| `/`      | Focus the search input           |
| `Escape` | Blur or dismiss the search input |
| `Enter`  | Submit the search form           |

---

## 🛠️ Technical Highlights

### Race-Safe API Requests

Each search request receives a unique `requestId`.

When a new search starts, the previous `AbortController` cancels the stale request. The request ID then ensures that an older response cannot overwrite the results of a newer search.

```text
New Search
    │
    ▼
Create requestId
    │
    ▼
Abort previous request
    │
    ▼
Fetch GitHub API
    │
    ▼
Check requestId
    │
    ├── Current → Render results
    │
    └── Stale   → Ignore response
```

### Intelligent Two-Layer Cache

The application checks the fastest available data source before making a network request:

```text
Search Query
     │
     ▼
Memory Cache
     │
     ├── Hit → Return immediately
     │
     ▼
localStorage Cache
     │
     ├── Valid → Restore cached data
     │
     ▼
GitHub REST API
     │
     ▼
Update Memory Cache
     │
     ▼
Update localStorage
```

Cached entries expire after **1 hour**.

### XSS-Safe Rendering

User-controlled GitHub data such as names, biographies, and URLs is processed through `escapeHtml()` before being inserted into the DOM.

This provides an important layer of protection against **cross-site scripting (XSS)** when rendering external API data.

### API Rate-Limit Handling

The application monitors GitHub API responses and handles rate-limit errors such as `403` and `429`.

When GitHub provides an `X-RateLimit-Reset` header, the application calculates the reset time and presents a user-friendly message instead of failing silently.

---

## 📸 Preview

The application opens with the **octocat** profile by default.

Search for any public GitHub username to explore:

* Profile avatar
* Name and username
* Bio
* Followers
* Following
* Public profile information
* Up to 6 recently updated repositories
* Repository links

The interface is designed to make GitHub profile exploration quick, visual, and lightweight.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

### Development Workflow

```bash
# Fork the repository

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes

# Commit your changes
git commit -m "Add amazing feature"

# Push your branch
git push origin feature/amazing-feature
```

Then open a **Pull Request** on GitHub.

---

## 📄 License

This project is distributed under the **MIT License**.

See the [`LICENSE`](./LICENSE) file for more information.

---

## 👤 Author

* GitHub: [@Nyvralis.Noctyra](https://github.com/nyvralisnoctyra)
* Project: **Day 1 — GitHub Profiles**
* Built as part of a hands-on JavaScript project series

---

<div align="center">

<sub>Built with vanilla JavaScript · No frameworks · No dependencies · GitHub REST API</sub>

</div>
