import "@logseq/libs";

/**
 * 
 * @param args - 宏参数数组
 * @returns 解析后的选项卡标题数组
 */
function parseTabTitles(args: string[]): string[] {
  if (!args || args.length < 2) return [];
  return args[1]
    .split("|")
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
}

// 定义事件数据的接口
interface MacroRendererSlotEventPayload {
  arguments: string[];
}

interface ModelEventData {
  direction?: string;
  parentid?: string;
  index?: string;
  parentlevel?: string;
  blockid?: string;
}

// 用于存储当前激活的 Tab 索引
const tabActionIndexs: Map<string, number> = new Map();

async function main() {
  // 注册斜杠命令
  logseq.Editor.registerSlashCommand("/tabs", async () => {
    await logseq.Editor.insertAtEditingCursor('{{renderer tabs,title1|title2|title3}}');
  });

  logseq.App.onMacroRendererSlotted(
    async ({ slot, payload }: { slot: string; payload: MacroRendererSlotEventPayload }) => {
      const [type] = payload.arguments;
      if (type !== "tabs") return;

      const tabTitles = parseTabTitles(payload.arguments);

      if (tabTitles.length === 0) return;

      let currentBlock: HTMLElement | null | undefined = null;
      let parentid: string = "";
      let isRef: boolean = false;

      // 检查是否是引用块
      const refBlock = parent.document.getElementById(slot)?.closest('.block-ref > .block-content');
      if (refBlock) {
        isRef = true;
        parentid = refBlock.getAttribute('blockid') || "";
        if (!parentid) return;
      }

      currentBlock = parent.document.getElementById(slot)?.closest('.ls-block');
      if (!currentBlock) return;

      const blockId = parentid || currentBlock.getAttribute('blockid') || "";
      const currentLevel = parseInt(currentBlock.getAttribute('level') || "0");
      const containerId = `block-tabs-${blockId}`;

      // 渲染 UI
      logseq.provideUI({
        key: containerId,
        slot,
        template: `
          <div class="block-tabs-header" id="${containerId}" data-on-dblclick="editBlock">
            <div class="block-tabs-edit" data-on-click="editBlock" data-blockid="${containerId}" title="Edit Tab Title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="block-tabs-arrow-container" data-on-click="arrowPull" style="display:none;" data-on-dblclick="return false;" data-direction="0" data-parentid="${containerId}">
              <div class="block-tabs-arrow block-tabs-left"></div>
            </div>
            <div class="block-tabs-container" style="max-width:800px;">
              ${tabTitles
                .map((title, index) => `
                <div class="block-tabs-tab"                   
                     data-index="${index}" 
                     data-parentid="${containerId}"
                     data-parentlevel="${currentLevel}"
                     data-on-click="activeTab">
                  ${title}
                </div>
              `)
                .join("")}
            </div>
            <div class="block-tabs-arrow-container" data-on-click="arrowPull" style="display:none;" data-on-dblclick="return false;" data-direction="1" data-parentid="${containerId}">
              <div class="block-tabs-arrow block-tabs-right"></div>
            </div>
          </div>
        `,
      });

      // 监听 DOM 变化以调整宽度
      const observer = new MutationObserver(() => {
        // 以 .block-content-inner 宽度为准
        const blockContentInner = (isRef ? parent.document : currentBlock).querySelector(".block-content-inner") as HTMLElement;
        const tabsContainer = blockContentInner?.querySelector('.block-tabs-container') as HTMLElement;

        if (!blockContentInner || !tabsContainer) return;

        tabsContainer.style.maxWidth = `${(blockContentInner?.offsetWidth || 800) - 64}px`;

        const tabsWidth = Array.from(tabsContainer.children).reduce(
          (sum, tab) => sum + (tab as HTMLElement).offsetWidth,
          0
        );

        const tabArrowContainer = (isRef ? parent.document : currentBlock).querySelectorAll(`#${containerId} .block-tabs-arrow-container`);
        tabArrowContainer.forEach((item) => {
          (item as HTMLElement).style.display = tabsWidth > tabsContainer.offsetWidth ? "flex" : "none";
        });

        let currentIndex = 0;
        if (tabActionIndexs.has(containerId)) {
          currentIndex = tabActionIndexs.get(containerId) || 0;
        } else {
          tabActionIndexs.set(containerId, 0);
        }

        const tabs = (isRef ? parent.document : currentBlock)?.querySelectorAll(`#${containerId} .block-tabs-tab`);
        const contents = (isRef ? parent.document : currentBlock)?.querySelectorAll(`.block-children-container .ls-block[level="${currentLevel + 1}"]`);

        if (contents.length > tabs?.length) {
          contents.forEach((item) => {
            (item as HTMLElement).style.display = "block";
          });
        }
        // else if (contents.length == 0)
        // logseq.Editor.insertBlock(blockId, "")

        if (tabs) {
          tabs.forEach((tab, i) => {
            if (contents[i]) {
              (contents[i] as HTMLElement).style.display = i == currentIndex ? "block" : "none";
            }

            if (i == currentIndex) {
              tabActionIndexs.set(containerId, i);
            }

            (tab as HTMLElement).classList.toggle('active', i == currentIndex);
          });
        }

        observer.disconnect();
      });

      observer.observe(isRef ? parent.document : currentBlock, { attributes: true, childList: true, subtree: true });
    }
  );

  // 提供样式
  logseq.provideStyle(`
    .block-tabs-header {
      display: flex;
      align-items: center;
      margin: 14px 0 8px 0;
      background-color: var(--ls-secondary-background-color);
      border-radius: 4px;
      position: relative;
    }
    
    .block-tabs-container 
    {
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      flex: 1;
    }
    
    .block-tabs-container::-webkit-scrollbar {
      display: none;
    }
    
    .block-tabs-tab {
      padding: 8px 16px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
      position: relative;
      z-index: 2;
    }
    
    .block-tabs-tab.active {
      font-weight: 600;
      border-bottom-color: var(--ls-link-text-color);
      background-color: var(--ls-tertiary-background-color);
      border-radius: 4px;
    }
    
    .block-tabs-tab:hover {
      background-color: var(--ls-quaternary-background-color);
      border-radius: 4px;
    }
    
    .block-tabs-arrow-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      cursor: pointer;
      background-color: var(--ls-secondary-background-color);
      z-index: 3;
    }
    
    .block-tabs-arrow {
      width: 0;
      height: 0;
      border-style: solid;
    }
    
    .block-tabs-left {
      border-width: 6px 10px 6px 0;
      border-color: transparent var(--ls-icon-color) transparent transparent;
    }
    
    .block-tabs-right {
      border-width: 6px 0 6px 10px;
      border-color: transparent transparent transparent var(--ls-icon-color);
    }
    
    .block-tabs-edit {
      position: absolute;
      left: -24px;
      top: 8px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 99;
      opacity: 0.3;
      transition: opacity 0.2s;
      color: var(--ls-icon-color);
      font-weight: 700;
    }
   
    .block-tabs-edit:hover {
      opacity: 1;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
      .block-tabs-tab {
        padding: 6px 12px;
        font-size: 0.9em;
      }
      .block-tabs-arrow-container {
        width: 24px;
      }
      .block-tabs-edit {
        top: 2px;
        right: 2px;
      }
    }
  `);

  // 提供模型事件处理
  logseq.provideModel({
    arrowPull(e: any & { dataset: ModelEventData } ) {
      const { direction, parentid } = e.dataset;
      if (!parentid) return;

      const container = parent.document.querySelector(`#${parentid} .block-tabs-container`);
      if (!container) return;

      const scrollAmount = direction === "1" ? 180 : -180;

      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    },

    async editBlock(e: any & { dataset: ModelEventData } ) {
      let blockid = e.dataset.blockid?.replace('block-tabs-', '');

      if (!blockid) {
        blockid = e.id?.replace('block-tabs-', '');
      }

      if (blockid) {
        await logseq.Editor.editBlock(blockid);
      }
    },

    activeTab(e: any & { dataset: ModelEventData } ) {
      let { index, parentid, parentlevel } = e.dataset;
      if (!index || !parentid || !parentlevel) return;

      // 检查是不是引用
      const refBlock = parent.document.getElementById(parentid)?.closest('.block-ref > .block-content');
      if (refBlock) {
        parentid = refBlock.getAttribute('blockid') || "";
        if (!parentid) {
          // 如果是引用且没有 blockid，尝试直接调用 activeTab（可能需要调整）
          // 这里假设 activeTab 可以接受事件对象，可能需要重构
          // 暂时简单处理为不执行
          return;
        } else {
          parentid = `block-tabs-${parentid}`;
        }
      }

      const currentBlock = parent.document.querySelector(
        `.ls-block[blockid="${parentid.replace('block-tabs-', '')}"]`
      );

      if (!currentBlock) return;

      const tabs = currentBlock?.querySelectorAll(`#${parentid} .block-tabs-tab`);
      const contents = currentBlock?.querySelectorAll(`.block-children-container .ls-block[level="${parseInt(parentlevel) + 1}"]`);

      if (tabs && contents) {
        tabs.forEach((tab, i) => {
          if (contents[i]) {
            (contents[i] as HTMLElement).style.display = i == parseInt(index) ? "block" : "none";
          }

          if (i == parseInt(index)) {
            tabActionIndexs.set(parentid, parseInt(index));
          }

          (tab as HTMLElement).classList.toggle('active', i == parseInt(index));
        });
      }
    }
  });

  // 监听数据库变化，处理 Tab 状态恢复
  logseq.DB.onChanged((e: any) => { // 如果有更具体的类型可以替换 `any`
    for (let [key, value] of tabActionIndexs) {
      if (!parent.document.querySelector(`#${key}`)) {
        tabActionIndexs.delete(key);

        const restoreBlock = parent.document.querySelector(
          `.ls-block[blockid="${key.replace('block-tabs-', '')}"]`
        );

        if (restoreBlock) {
          let level = restoreBlock.getAttribute('level');
          if (!level) return;

          const contentBlocks = restoreBlock?.querySelectorAll(`.block-children-container .ls-block[level="${parseInt(level) + 1}"]`);

          if (contentBlocks) {
            contentBlocks.forEach((item) => {
              (item as HTMLElement).style.display = "block";
            });
          }
        }
      }
    }
  });
}

// 启动插件
logseq.ready(main).catch(console.error);