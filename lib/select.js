/*
 * @Author: CHENY ycyplus@gmail.com
 * @Date: 2026-06-12 08:50:19
 * @LastEditors: CHENY ycyplus@gmail.com
 * @LastEditTime: 2026-06-12 10:41:36
 * @FilePath: \vscode-config-installer\lib\select.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * select.js — prompts 兼容层
 *
 * 使用 enquirer（活跃维护、CJS 原生）替代已停止维护的 prompts。
 * 对外暴露与 prompts({ type:'select', ... }) 完全相同的调用签名和返回值，
 * 无需修改业务调用处的逻辑。
 *
 * 入参: { name, message, choices: [{title, value, disabled?}], initial? }
 * 返回: { [name]: value }  — 与 prompts 一致；用户 Ctrl+C 时返回 {}
 */

const { Select } = require('enquirer');

/**
 * @param {object} opts
 * @param {string} opts.name       - 返回对象的 key（与 prompts 保持一致）
 * @param {string} opts.message    - 提示文字
 * @param {Array<{title:string, value:*, disabled?:boolean}>} opts.choices
 * @param {number} [opts.initial=0] - 默认高亮的选项索引
 * @returns {Promise<Record<string, *>>}  { [name]: selectedValue }，取消时为 {}
 */
async function select({ name, message, choices, initial = 0 }) {
  // enquirer choices: name(唯一 key) + message(显示文字) + value(返回值)
  const enquirerChoices = choices.map((c, i) => {
    const ch = {
      name: `__item_${i}`, // 内部唯一标识（enquirer 要求 name 唯一）
      message: c.title, // 显示文字
      value: c.value, // 实际返回值（enquirer 优先返回 value）
    };
    if (c.disabled) ch.disabled = true;
    return ch;
  });

  try {
    const prompt = new Select({ message, choices: enquirerChoices, initial });
    const result = await prompt.run(); // enquirer 返回 value（若设了value）
    return { [name]: result };
  } catch (_) {
    // Ctrl+C / ESC → 与 prompts 取消行为一致，返回 {}
    return {};
  }
}

module.exports = select;
