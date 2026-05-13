
# ScriptForge

> Template engine for Huawei VRP network device configuration scripts.

ScriptForge is a local web app that lets you store, manage, and fill in parametrized `.cfg` configuration templates for Huawei Cloud Engine switches and OceanStor storage systems. Instead of editing scripts by hand every deployment, you define variables like `{SWITCH_NAME}` or `{MGMT_IP}` once in the template — ScriptForge generates a ready-to-paste script in seconds.

---

## Features

- **Template library** — browse and search all `.cfg` templates organized by category
- **Variable forms** — every `{VARIABLE}` in a template becomes a form field automatically
- **Script output** — copy to clipboard or download as `.txt` in one click
- **Import & export** — load individual `.cfg` files or full `.zip` archives; export everything as a zip backup
- **Category management** — create, reorder (drag & drop), and delete categories with custom icons and colors
- **Edit in-app** — modify any template directly from the browser without touching the filesystem
- **Persistent storage** — templates live as plain `.cfg` files on disk; categories stored in `categories.json`
- **Dark / light mode** — toggle from the top bar

---

## Project Structure

```
scriptforge/
├── scriptforge.html        # Main app entry point
├── server.py               # Local HTTP + REST API server
├── categories.json         # Category definitions (auto-created on first run)
├── templates/              # .cfg template files
│   ├── management-ce-switch-initialization.cfg
│   ├── mlag-mlag-configuration-switch-a.cfg
│   └── ...
├── style/
│   ├── scriptforge.css     # Main stylesheet
│   └── modals.css          # Modal styles
└── js/
    ├── data.js             # Icons, colors, parseCfg()
    ├── app.js              # State, loadTemplates()
    ├── ui.js               # Render functions, modal helpers
    └── events.js           # All event listeners
```

---

## Getting Started

### Requirements

- Python 3.8+
- A modern browser (Chrome, Firefox, Edge)

### Run

```bash
python server.py
```

Then open [http://localhost:5500](http://localhost:5500) in your browser.

The server serves the static frontend and exposes a REST API at `/api/`. Templates are read from and written to the `templates/` directory on disk.

---

## Template Format

Templates are plain `.cfg` text files with a metadata header:

```
# name: CE Switch Initialization
# category: Management
# description: Initial setup: sysname, SSH user, management port.

system-view
sysname {SWITCH_NAME}
commit

interface MEth0/0/0
 ip address {MGMT_IP} {SUBNET_MASK}
commit
```

### Metadata fields

| Field           | Required | Description                            |
| --------------- | -------- | -------------------------------------- |
| `name`        | ✅       | Display name shown on the card         |
| `category`    | ✅       | Must match an existing category ID     |
| `description` | —       | Short description shown under the name |

### Variables

Any `{UPPERCASE_TOKEN}` in the script body becomes a form field when the template is opened. Variable names support letters, numbers, and underscores.

```
{SWITCH_NAME}        → text field labelled "SWITCH NAME"
{MGMT_IP}           → text field labelled "MGMT IP"
{DOWNLINK_INT_START} → text field labelled "DOWNLINK INT START"
```

---

## REST API

The server exposes the following endpoints:

| Method     | Path                         | Description                                     |
| ---------- | ---------------------------- | ----------------------------------------------- |
| `GET`    | `/api/templates`           | List all `.cfg` filenames                     |
| `POST`   | `/api/templates`           | Save a template `{ filename, content }`       |
| `DELETE` | `/api/templates/:filename` | Delete a template file                          |
| `GET`    | `/api/categories`          | List all categories                             |
| `POST`   | `/api/categories`          | Create a category `{ id, icon, color }`       |
| `DELETE` | `/api/categories/:id`      | Delete a category                               |
| `POST`   | `/api/categories/reorder`  | Reorder categories `{ order: [id, ...] }`     |
| `GET`    | `/api/export`              | Download all templates + categories as `.zip` |

---

## Included Templates

| Template                         | Category   | Description                                                |
| -------------------------------- | ---------- | ---------------------------------------------------------- |
| CE Switch Initialization         | Management | Sysname, SSH user (sshadmin), MEth0/0/0 management port    |
| MLAG Configuration — Switch A   | MLAG       | V-STP, DFS group 1, peer-link Eth-Trunk1                   |
| MLAG Configuration — Switch B   | MLAG       | Same as A with IPs swapped                                 |
| Uplink Configuration — Switch A | MLAG       | Eth-Trunk10 LACP uplink with VLAN trunking                 |
| Uplink Configuration — Switch B | MLAG       | Same as A                                                  |
| Downlink VLAN Trunk              | MLAG       | VLAN creation + 25GE trunk port assignment                 |
| RoCE Configuration               | GVA        | Lossless RoCEv2 Q4 with PFC, ECN, headroom 6 MB, DRR 90/10 |

---

## Adding Templates Manually

Drop a `.cfg` file with the correct header into the `templates/` directory and reload the page — it will appear in the grid immediately. Filenames follow the convention `category-template-name.cfg` (lowercase, hyphenated).

---

## License

Internal tooling — not for redistribution.
