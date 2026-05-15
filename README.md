# 招投标商机智能雷达 POC

基于三份项目文档生成的前后端分离 POC。前端使用 React + Next.js，后端使用 Python Flask。

## 功能范围

- 首页概览：今日扫描、AI 初筛、高优先级推荐、风险提示、节省时间等指标。
- 标讯推荐列表：按推荐等级、风险等级、关键词筛选。
- 标讯分析详情：基础信息、AI 摘要、客户匹配、能力匹配、风险分析、推荐结论、下一步建议。
- 一键生成线索/商机草稿：自动带入项目、客户、来源、摘要、推荐理由、风险提示和协同部门。
- 销售反馈：支持“有价值”“观察池”“不相关”“资质不满足”等反馈选项。
- 后端规则引擎：使用样例客户、能力知识库、风险数据进行匹配和评分。

## 目录结构

```text
backend/
  app.py                 Flask API 入口
  data/seed.py           POC 样例数据
  services/radar.py      解析、匹配、评分和草稿服务
frontend/
  app/                   Next.js App Router 页面
  components/            UI 组件
  lib/api.ts             API 客户端
source-docs-extracted.md 三份 Word 文档提取文本
```

## 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

后端默认运行在 `http://127.0.0.1:5001`。

## 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:3000`。

如需修改 API 地址，可在前端启动前设置：

```bash
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5001/api
```

## API 摘要

- `GET /api/overview`
- `GET /api/tenders`
- `GET /api/tenders/<id>`
- `POST /api/tenders/<id>/drafts`
- `GET /api/drafts/<id>`
- `PATCH /api/drafts/<id>`
- `POST /api/feedback`
