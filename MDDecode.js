class MDdecoder {
  // 内置全局插件
  Ptitle = {
    type: true,
    regex: /^#{1,6}\s/,
    callback: (line) => {
      const m = line.match(/^(#{1,6})\s+(.*)/);
      if (!m) return null;
      const level = m[1].length;
      const text = m[2].trim();
      return {
        html: `<h${level} data-level="${level}" data-name="${text}">${text}</h${level}>`,
        level
      };
    }
  }
  PorderedList = {
    type: true,
    regex: /^\d+\.\s/,
    callback: (line) => {
      const text = line.replace(/^\d+\.\s+/, '').trim();
      return { html: `<li>${text}</li>`, level: -1 };
    }
  }
  Pblockquote = {
    type: true,
    regex: /^>\s?/,
    callback: (line) => {
      const text = line.replace(/^>\s?/, '').trim();
      return { html: text, level: -2 }; // -2 表示引用内容，需要外层 <blockquote>
    }
  }
  Phr = {
    type: true,
    regex: /^(-{3,}|_{3,}|\*{3,})\s*$/,
    callback: () => ({ html: '<hr/>', level: 0 })
  }

  // 内置行内插件
  Pbold = {
    type: false,
    regex: /\*\*(.+?)\*\*/g,
    callback: (_, text) => `<strong>${text}</strong>`
  }
  Pitalic = {
    type: false,
    regex: /\*(.+?)\*/g,
    callback: (_, text) => `<em>${text}</em>`
  }
  Pstrikethrough = {
    type: false,
    regex: /~~(.+?)~~/g,
    callback: (_, text) => `<del>${text}</del>`
  }
  PinlineCode = {
    type: false,
    regex: /`(.+?)`/g,
    callback: (_, code) => `<code>${code}</code>`
  }
  Plink = {
    type: false,
    regex: /\[([^\]]+)\]\(([^)]+)\)/g,
    callback: (_, text, url) => `<a href="${url}">${text}</a>`
  }
  Pimage = {
    type: false,
    regex: /!\[([^\]]*)\]\(([^)]+)\)/g,
    callback: (_, alt, url) => `<img src="${url}" alt="${alt}">`
  }

  constructor(markdown) {
    this.MD = markdown;
    this.globalPlugins = [this.Ptitle, this.PorderedList, this.Pblockquote, this.Phr];
    this.localPlugins = [this.Pbold, this.Pitalic, this.Pstrikethrough, this.PinlineCode, this.Plink, this.Pimage];
  }

  /**
   * 注册插件
   * @param {object} plugin
   *  - type: true → 全局插件；false/无 → 行内处理插件
   *  - regex: RegExp 用于行匹配（全局）或整体替换（本地）
   *  - callback: 处理函数
   */
  usePlugin(plugin) {
    if (!plugin) return this;
    if (plugin.type) {
      this.globalPlugins.push(plugin);
    } else {
      this.localPlugins.push(plugin);
    }
    return this; // 链式调用
  }
  decode() {
    if (this.MD === "") return "";

    // 预处理：合并多行块（列表、引用、代码块）
    let processedLines = this._preprocessBlocks(this.MD.split('\n'));

    // 原来的逐行处理逻辑，但 now 处理的是合并后的行数组
    const outputLines = [];
    const stack = [0];

    const closeDivsUntil = (level) => {
      while (stack.length && stack[stack.length - 1] >= level) {
        outputLines.push('</div>');
        stack.pop();
      }
    };

    for (const line of processedLines) {
      let handled = false;
      for (const plugin of this.globalPlugins) {
        if (plugin.regex && plugin.regex.test(line)) {
          const result = plugin.callback(line);
          if (result && result.html !== undefined) {
            if (result.level > 0) {
              closeDivsUntil(result.level);
              if (!stack.length || stack[stack.length - 1] < result.level) {
                outputLines.push('<div>');
                stack.push(result.level);
              }
            }
            outputLines.push(result.html);
          }
          handled = true;
          break;
        }
      }
      if (!handled) {
        outputLines.push(line);   // 普通段落或空行
      }
    }

    closeDivsUntil(0);
    let finalHtml = outputLines.join('\n');

    // 应用本地插件
    for (const plugin of this.localPlugins) {
      if (plugin.regex && typeof plugin.callback === 'function') {
        finalHtml = finalHtml.replace(plugin.regex, (...args) => plugin.callback(...args));
      }
    }

    // 后处理：将连续的普通行包裹为 <p>
    finalHtml = this._wrapParagraphs(finalHtml);

    return finalHtml;
  }
  _preprocessBlocks(lines) {
    const result = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 围栏代码块
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code += lines[i] + '\n';
          i++;
        }
        i++; // 跳过结束 ```
        result.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${code.trim()}</code></pre>`);
        continue;
      }
      // 无序列表连续行
      if (/^[\-\*\+]\s/.test(line)) {
        let items = [];
        while (i < lines.length && /^[\-\*\+]\s/.test(lines[i])) {
          const text = lines[i].replace(/^[\-\*\+]\s+/, '').trim();
          items.push(`<li>${text}</li>`);
          i++;
        }
        result.push(`<ul>${items.join('')}</ul>`);
        continue;
      }
      // 有序列表连续行
      if (/^\d+\.\s/.test(line)) {
        let items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          const text = lines[i].replace(/^\d+\.\s+/, '').trim();
          items.push(`<li>${text}</li>`);
          i++;
        }
        result.push(`<ol>${items.join('')}</ol>`);
        continue;
      }
      // 引用连续行
      if (/^>\s?/.test(line)) {
        let quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          const text = lines[i].replace(/^>\s?/, '');
          quoteLines.push(text);
          i++;
        }
        result.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
        continue;
      }
      // 其他行原样
      result.push(line);
      i++;
    }
    return result;
  }
  _wrapParagraphs(html) {
    const lines = html.split('\n');
    const result = [];
    let para = [];
    for (const line of lines) {
      if (line.trim() === '' || line.startsWith('<')) {
        if (para.length) {
          result.push(`<p>${para.join('\n')}</p>`);
          para = [];
        }
        result.push(line);
      } else {
        para.push(line);
      }
    }
    if (para.length) result.push(`<p>${para.join('\n')}</p>`);
    return result.join('\n');
  }
}

/*
// ---------- 使用示例 ----------
const md = `
# 标题
这是**粗体**和*斜体*文字。

- 列表项1
- 列表项2
  - 嵌套需手动处理

> 引用内容
> 第二行

\`\`\`javascript
console.log("hello");
\`\`\`

1. 第一
2. 第二
`;

const decoder = new MDdecoder(md);

console.log(decoder.decode());
*/