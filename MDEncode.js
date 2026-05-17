class HTMLtoMD {
  // ========== 内置插件 ==========

  // 全局
  Pheading = {
    type: true,
    selector: (node) => /^H[1-6]$/.test(node.nodeName),
    callback: (node, innerMD) => {
      const level = parseInt(node.nodeName[1]);
      return '#'.repeat(level) + ' ' + innerMD + '\n\n';
    }
  };

  Pparagraph = {
    type: true,
    selector: (node) => node.nodeName === 'P',
    callback: (node, innerMD) => innerMD + '\n\n'
  };

  PunorderedList = {
    type: true,
    selector: (node) => node.nodeName === 'UL',
    callback: (node, innerMD) => innerMD.trim() + '\n\n'
  };

  PorderedList = {
    type: true,
    selector: (node) => node.nodeName === 'OL',
    callback: (node, innerMD) => {
      return innerMD.trim() + '\n\n';
    }
  };

  PlistItem = {
    type: true,
    selector: (node) => node.nodeName === 'LI',
    callback: (node, innerMD) => {
      const parent = node.parentNode;
      const isOrdered = parent && parent.nodeName === 'OL';
      if (isOrdered) {
        // 获取在兄弟 li 中的位置
        const index = Array.from(parent.children).indexOf(node) + 1;
        return `${index}. ${innerMD}\n`;
      } else {
        return `- ${innerMD}\n`;
      }
    }
  };

  Pblockquote = {
    type: true,
    selector: (node) => node.nodeName === 'BLOCKQUOTE',
    callback: (node, innerMD) => {
      // 每行加 "> "
      return '> ' + innerMD.replace(/\n/g, '\n> ') + '\n\n';
    }
  };

  Phr = {
    type: true,
    selector: (node) => node.nodeName === 'HR',
    callback: () => '---\n\n'
  };

  PcodeBlock = {
    type: true,
    selector: (node) => node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE',
    callback: (node) => {
      const code = node.textContent || '';
      const lang = node.firstChild.className.replace('language-', '');
      return '```' + (lang || '') + '\n' + code + '\n```\n\n';
    }
  };
  // 行内
  Pstrong = {
    type: false,
    selector: (node) => node.nodeName === 'STRONG' || node.nodeName === 'B',
    callback: (node, innerMD) => `**${innerMD}**`
  };

  Pem = {
    type: false,
    selector: (node) => node.nodeName === 'EM' || node.nodeName === 'I',
    callback: (node, innerMD) => `*${innerMD}*`
  };

  Pdel = {
    type: false,
    selector: (node) => node.nodeName === 'DEL' || node.nodeName === 'S',
    callback: (node, innerMD) => `~~${innerMD}~~`
  };

  Pcode = {
    type: false,
    selector: (node) => node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE',
    callback: (node, innerMD) => `\`${innerMD}\``
  };

  Plink = {
    type: false,
    selector: (node) => node.nodeName === 'A',
    callback: (node, innerMD) => `[${innerMD}](${node.getAttribute('href') || ''})`
  };

  Pimage = {
    type: false,
    selector: (node) => node.nodeName === 'IMG',
    callback: (node) => `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`
  };

  Pbr = {
    type: false,
    selector: (node) => node.nodeName === 'BR',
    callback: () => '\n'
  };

  constructor(html) {
    this.HTML = html;
    this.globalPlugins = [
      this.Pheading,
      this.Pparagraph,
      this.PunorderedList,
      this.PorderedList,
      this.PlistItem,
      this.Pblockquote,
      this.Phr,
      this.PcodeBlock
    ];
    this.localPlugins = [
      this.Pstrong,
      this.Pem,
      this.Pdel,
      this.Pcode,
      this.Plink,
      this.Pimage,
      this.Pbr
    ];
  }

  /**
   * 注册插件
   * @param {object} plugin
   *  - type: true 全局（块级） / false 本地（行内）
   *  - selector: (node) => boolean  检测是否应处理该节点
   *  - callback: (node, innerMD) => string  返回转换后的 Markdown
   */
  usePlugin(plugin) {
    if (!plugin) return this;
    if (plugin.type) {
      this.globalPlugins.push(plugin);
    } else {
      this.localPlugins.push(plugin);
    }
    return this;
  }

  encode() {
    if (!this.HTML) return '';
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.HTML, 'text/html');
    const body = doc.body;
    
    return this._processNode(body).trim();
  }

  /**
   * 递归处理 DOM 节点
   * @param {Node} node
   * @returns {string} Markdown 文本
   */
  _processNode(node) {
    if (node.nodeType === 3) {
      return node.textContent.replace(/\n/g, ' ');
    }
    
    // 元素节点
    if (node.nodeType === 1) { // ELEMENT_NODE
      let innerMD = '';
      for (const child of node.childNodes) {
        innerMD += this._processNode(child);
      }

      for (const plugin of this.localPlugins) {
        if (plugin.selector && plugin.selector(node)) {
          return plugin.callback(node, innerMD);
        }
      }

      for (const plugin of this.globalPlugins) {
        if (plugin.selector && plugin.selector(node)) {
          return plugin.callback(node, innerMD);
        }
      }

      return innerMD;
    }
    
    return '';
  }
}

/*
// ---------- 使用示例 ----------
const htmlInput = `
<div>
  <h1>标题</h1>
  <p>这是 <strong>粗体</strong> 和 <em>斜体</em>。</p>
  <ul>
    <li>项目1</li>
    <li>项目2</li>
  </ul>
  <blockquote>
    <p>引用文字</p>
  </blockquote>
  <pre><code class="language-javascript">console.log('hello');</code></pre>
  <p><a href="https://example.com">链接</a></p>
  <img src="image.png" alt="示例" />
</div>
`;

const converter = new HTMLtoMD(htmlInput);
// 可额外注册插件
converter.usePlugin({
  type: false,
  selector: (node) => node.nodeName === 'MARK',
  callback: (_, inner) => `==${inner}==`
});

console.log(converter.decode());

*/