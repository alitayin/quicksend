# ecash-quicksend — Claude Code Notes

## 施工手册

`IMPROVEMENTS.md` 是本项目的施工手册，记录了所有代码改进建议。
- ✅ 表示已完成的项
- 未标记的项为待实施改进
- 优先级表见文件末尾

## 参考代码库

ecash-wallet 参考实现位于：`.local-reference/ecash-wallet/`

该目录包含 ecash-wallet 库的源码，作为最佳实践参考（类型定义、UTXO 处理、HD 钱包等）。重要参考文件：
- `.local-reference/ecash-wallet/hd-wallet-punchlist.md` — HD 钱包功能清单
- `.local-reference/ecash-wallet/chained.md` — 链式交易规范

## 项目概览

- **入口**: `index.ts`
- **发送逻辑**: `send/xecsend.ts`（XEC）, `send/tokensend.ts`（SLP/ALP）
- **交易构建**: `transaction/transaction-utils.ts`
- **UTXO 工具**: `utxo/utxo-utils.ts`
- **钱包工具**: `wallet/wallet-utils.ts`, `wallet/mnemonic-utils.ts`
- **类型定义**: `types.ts`
- **常量**: `config/constants.ts`
