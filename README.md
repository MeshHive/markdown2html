# 项目介绍

适用于前后端的 MarkDown 解析器

和适用于前端或后端手动安装jsdom的编码器

可以将 HTML 与 MarkDown 相互转换

## 特性

- 块转换带<div></div>
- 可以编写插件添加功能
- 使用 class 方便使用

## 关于插件

编码器：
```js
{
  type: false, // 标记为块插件还是行内插件sssesswswsss
  selector: (node) => node.nodeName === 'MARK',
  callback: (_, inner) => `==${inner}==`
}

```