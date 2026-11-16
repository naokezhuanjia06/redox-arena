/* ============================================================
   xlsx.js —— 零依赖读取 Excel(.xlsx)：ZIP 解包 + sharedStrings + 工作表解析
   原理：xlsx 本质是 zip；用 DecompressionStream('deflate-raw') 解压，
   再用 DOMParser 读 xl/sharedStrings.xml 与 xl/worksheets/sheet*.xml。
   返回二维数组（行 → 单元格文本），供 RX.roster.importRows 使用。
   ============================================================ */
(function () {
  window.RX = window.RX || {};

  const u16 = (dv, p) => dv.getUint16(p, true);
  const u32 = (dv, p) => dv.getUint32(p, true);

  function findEOCD(bytes) {
    const min = Math.max(0, bytes.length - 66000);
    for (let i = bytes.length - 22; i >= min; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('NO_INFLATE');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function unzip(buffer) {
    const bytes = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const eocd = findEOCD(bytes);
    if (eocd < 0) throw new Error('不是有效的 .xlsx 文件');
    const count = u16(dv, eocd + 10);
    let off = u32(dv, eocd + 16);
    const entries = {};
    const order = [];
    for (let i = 0; i < count; i++) {
      if (off + 46 > bytes.length || u32(dv, off) !== 0x02014b50) break;
      const method = u16(dv, off + 10);
      const csize = u32(dv, off + 20);
      const nameLen = u16(dv, off + 28);
      const extraLen = u16(dv, off + 30);
      const cmtLen = u16(dv, off + 32);
      const localOff = u32(dv, off + 42);
      const name = new TextDecoder('utf-8').decode(bytes.subarray(off + 46, off + 46 + nameLen));
      entries[name] = { method, csize, localOff };
      order.push(name);
      off += 46 + nameLen + extraLen + cmtLen;
    }
    return { entries, order, bytes, dv };
  }

  async function readEntry(zip, name) {
    const e = zip.entries[name];
    if (!e) return null;
    const { dv, bytes, order } = zip;
    const lo = e.localOff;
    if (u32(dv, lo) !== 0x04034b50) return null;
    const nameLen = u16(dv, lo + 26);
    const extraLen = u16(dv, lo + 28);
    const start = lo + 30 + nameLen + extraLen;
    let size = e.csize;
    if (!size) {
      /* 某些写入器把大小放在数据描述符里，用下一条目的偏移兜底 */
      const idx = order.indexOf(name);
      const nextName = order[idx + 1];
      size = nextName ? zip.entries[nextName].localOff - start : bytes.length - start;
    }
    const raw = bytes.subarray(start, start + size);
    if (e.method === 0) return new TextDecoder('utf-8').decode(raw);
    return new TextDecoder('utf-8').decode(await inflateRaw(raw));
  }

  function colIndex(letters) {
    let n = 0;
    for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return Math.max(0, n - 1);
  }

  /* ---- 主入口：返回 [[c1,c2,c3...], ...] ---- */
  RX.readXlsx = async function (buffer) {
    const zip = unzip(buffer);

    /* 共享字符串表 */
    const shared = [];
    const ssXml = await readEntry(zip, 'xl/sharedStrings.xml');
    if (ssXml) {
      const doc = new DOMParser().parseFromString(ssXml, 'application/xml');
      Array.prototype.forEach.call(doc.getElementsByTagName('si'), si => {
        const ts = si.getElementsByTagName('t');
        let s = '';
        for (let i = 0; i < ts.length; i++) s += ts[i].textContent;
        shared.push(s);
      });
    }

    /* 第一张工作表 */
    let sheetName = 'xl/worksheets/sheet1.xml';
    if (!zip.entries[sheetName]) {
      sheetName = zip.order.find(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n)) || '';
    }
    if (!sheetName) throw new Error('Excel 里没有找到工作表');
    const sheetXml = await readEntry(zip, sheetName);
    const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');

    const rows = [];
    Array.prototype.forEach.call(doc.getElementsByTagName('row'), rowEl => {
      const arr = [];
      Array.prototype.forEach.call(rowEl.getElementsByTagName('c'), c => {
        const ref = c.getAttribute('r') || '';
        const col = colIndex(ref.replace(/[^A-Z]/g, '') || 'A');
        const t = c.getAttribute('t');
        let val = '';
        if (t === 'inlineStr') {
          const ts = c.getElementsByTagName('t');
          for (let i = 0; i < ts.length; i++) val += ts[i].textContent;
        } else {
          const v = c.getElementsByTagName('v')[0];
          val = v ? v.textContent : '';
          if (t === 's') val = shared[+val] != null ? shared[+val] : '';
        }
        arr[col] = String(val).trim();
      });
      rows.push(Array.from(arr, x => (x == null ? '' : x)));
    });
    return rows;
  };
})();
