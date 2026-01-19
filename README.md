# ParaCad - 节点式参数化建模系统 / Node-based Parametric Modeling System

<div align="center">

**基于 Web 的节点式可视化参数化建模系统**  
**Web-based Node Visual Parametric Modeling System**

[![Live Demo](https://img.shields.io/badge/🔗-Live_Demo-blue?style=for-the-badge)](https://zly258.github.io/paracad/)
[![License](https://img.shields.io/badge/License-Non--Commercial-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2.3-blue.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.174.0-orange.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)

[English](#english) | [中文](#chinese)

</div>

---

## <span id="english">English</span>

### Overview

ParaCad is a web-based node visual parametric modeling system, similar to Rhino/Grasshopper but implemented in the browser using native Three.js. It provides an intuitive node-based interface for creating complex 3D parametric models through visual programming.

### Key Features

#### 🎨 **Visual Node Editor**
- Drag-and-drop node interface
- Real-time parameter connections
- Node categorization (Basic, 2D Shapes, 3D Solids, Features, Transforms)
- Multi-language support (Chinese/English)

#### 🔧 **Rich Node Library**
- **Parameters & Logic**: Parameter, Expression, Custom nodes
- **2D Primitives**: Line, Rectangle, Circle, Arc, Ellipse, Polygon, Star
- **3D Solids**: Box, Sphere, Capsule, Cylinder, Cone, Frustum, Torus
- **Polyhedrons**: Tetrahedron, Octahedron, Icosahedron
- **Transforms**: Translation, Rotation, Scale, Array operations

#### 🌐 **3D Visualization**
- Real-time 3D rendering with Three.js
- Interactive viewport controls
- Material and lighting support
- Performance optimized with BVH acceleration

#### 📊 **Advanced Features**
- Graph-based dependency management
- Automatic layout algorithms
- Geometric operations and CSG
- Export capabilities

### Technology Stack

- **Frontend**: React 19 + TypeScript
- **3D Engine**: Three.js with React Three Fiber
- **UI Components**: Lucide React Icons
- **Layout**: Dagre for automatic graph layout
- **Geometry**: Three-Mesh-BVH for performance
- **Build Tool**: Vite

### Getting Started

#### 🚀 Live Preview

You can try ParaCad online without installing anything:

[**🔗 Try Online Demo**](https://zly258.github.io/paracad/)

#### Prerequisites
- Node.js (latest LTS version recommended)
- npm or yarn package manager

#### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd paracad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

#### Building for Production

```bash
npm run build
npm run preview
```

#### Deploy to GitHub Pages

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

Quick setup:
1. Push to GitHub
2. Go to Settings → Pages → Set Source to `GitHub Actions`
3. Deployment will run automatically on pushes to main branch

### Project Structure

```
paracad/
├── components/
│   ├── NodeEditor/          # Node-based editor components
│   │   ├── NodeCanvas.tsx   # Main canvas component
│   │   ├── NodeComponent.tsx # Individual node component
│   │   ├── NodeTree.tsx     # Node tree/sidebar
│   │   └── ConnectionLayer.tsx # Connection management
│   └── Viewport/            # 3D viewport components
│       └── Viewer3D.tsx     # 3D scene viewer
├── store/                   # State management
│   └── GraphStore.tsx       # Graph state management
├── utils/                   # Utility functions
│   ├── autoLayout.ts        # Automatic layout algorithms
│   └── geometryEngine.ts    # Geometric operations
├── App.tsx                  # Main application component
├── types.ts                 # TypeScript type definitions
├── translations.ts          # Multi-language translations
└── constants.ts             # Application constants
```

### Usage Guide

#### Creating Your First Model

1. **Add Parameters**: Start by adding parameter nodes to define your variables
2. **Connect Nodes**: Drag connections between nodes to establish relationships
3. **Add Geometry**: Use 2D and 3D primitive nodes to create basic shapes
4. **Transform Objects**: Apply transformations like translation, rotation, and scaling
5. **View Results**: Switch to the 3D viewport to see your parametric model

#### Node Categories

- **基础 & 参数 (Basic & Params)**: Fundamental nodes for parameters and logic
- **2D 线框 (2D Shapes)**: Two-dimensional geometric primitives
- **3D 实体 (3D Solids)**: Three-dimensional solid geometry
- **特征建模 (Features)**: Advanced modeling operations
- **变换 & 阵列 (Transforms)**: Transformation and array operations

### Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### License

This project is licensed under a modified MIT License with non-commercial use restrictions. See the [LICENSE](LICENSE) file for details.

**Key Points:**
- ✅ Free for personal and educational use
- ❌ Commercial use is prohibited
- 📝 Attribution to the original author is required

---

## <span id="chinese">中文</span>

### 项目概述

ParaCad 是一个基于 Web 的节点式可视化参数化建模系统，类似于 Rhino/Grasshopper，但在浏览器中使用原生 Three.js 实现。它通过可视化编程提供了直观的节点式界面，用于创建复杂的 3D 参数化模型。

### 核心功能

#### 🎨 **可视化节点编辑器**
- 拖拽式节点界面
- 实时参数连接
- 节点分类（基础、2D形状、3D实体、特征、变换）
- 多语言支持（中文/英文）

#### 🔧 **丰富的节点库**
- **参数和逻辑**: 参数、表达式、自定义节点
- **2D 图元**: 直线、矩形、圆、圆弧、椭圆、多边形、星形
- **3D 实体**: 立方体、球体、胶囊体、圆柱、圆锥、圆台、圆环体
- **多面体**: 四面体、八面体、二十面体
- **变换**: 平移、旋转、缩放、阵列操作

#### 🌐 **3D 可视化**
- 基于 Three.js 的实时 3D 渲染
- 交互式视口控制
- 材质和光照支持
- 使用 BVH 加速优化性能

#### 📊 **高级功能**
- 基于图的依赖关系管理
- 自动布局算法
- 几何操作和 CSG
- 导出功能

### 技术栈

- **前端**: React 19 + TypeScript
- **3D 引擎**: Three.js + React Three Fiber
- **UI 组件**: Lucide React 图标
- **布局**: Dagre 自动图布局
- **几何**: Three-Mesh-BVH 性能优化
- **构建工具**: Vite

### 快速开始

#### 🚀 在线预览

无需安装任何工具即可在线体验 ParaCad：

[**🔗 在线体验 Demo**](https://zly258.github.io/paracad/)

#### 环境要求
- Node.js（推荐使用最新 LTS 版本）
- npm 或 yarn 包管理器

#### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd paracad
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **设置环境变量**
   在根目录创建 `.env.local` 文件：
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **运行开发服务器**
   ```bash
   npm run dev
   ```

5. **打开浏览器**
   访问 `http://localhost:5173`

#### 构建生产版本

```bash
npm run build
npm run preview
```

#### 部署到 GitHub Pages

详细部署指南请参见 [DEPLOYMENT.md](DEPLOYMENT.md)。

快速设置：
1. 推送代码到 GitHub
2. 进入 Settings → Pages → 将 Source 设置为 `GitHub Actions`
3. 推送到 main 分支会自动触发部署

### 项目结构

```
paracad/
├── components/
│   ├── NodeEditor/          # 节点编辑器组件
│   │   ├── NodeCanvas.tsx   # 主画布组件
│   │   ├── NodeComponent.tsx # 单个节点组件
│   │   ├── NodeTree.tsx     # 节点树/侧边栏
│   │   └── ConnectionLayer.tsx # 连接管理
│   └── Viewport/            # 3D 视口组件
│       └── Viewer3D.tsx     # 3D 场景查看器
├── store/                   # 状态管理
│   └── GraphStore.tsx       # 图形状态管理
├── utils/                   # 工具函数
│   ├── autoLayout.ts        # 自动布局算法
│   └── geometryEngine.ts    # 几何操作
├── App.tsx                  # 主应用组件
├── types.ts                 # TypeScript 类型定义
├── translations.ts          # 多语言翻译
└── constants.ts             # 应用常量
```

### 使用指南

#### 创建你的第一个模型

1. **添加参数**: 首先添加参数节点来定义变量
2. **连接节点**: 拖拽连接节点建立关系
3. **添加几何体**: 使用 2D 和 3D 图元节点创建基本形状
4. **变换对象**: 应用平移、旋转、缩放等变换
5. **查看结果**: 切换到 3D 视口查看参数化模型

#### 节点分类

- **基础 & 参数**: 参数和逻辑的基础节点
- **2D 线框**: 二维几何图元
- **3D 实体**: 三维实体几何
- **特征建模**: 高级建模操作
- **变换 & 阵列**: 变换和阵列操作

### 贡献

我们欢迎贡献！请随时提交 Pull Request。

### 许可证

本项目基于修改版 MIT 许可证，包含非商业使用限制。详见 [LICENSE](LICENSE) 文件。

**要点：**
- ✅ 个人和教育用途免费
- ❌ 禁止商业用途
- 📝 必须注明原作者

---

<div align="center">

**Made with ❤️ using React + Three.js**

[⬆ 回到顶部 / Back to Top](#paracad---节点式参数化建模系统--node-based-parametric-modeling-system)

</div>