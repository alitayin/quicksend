// test-send-100xec.mjs
import quick from './dist/index.js';  // 改成 dist/index.js

const recipients = [
  {
    address: 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv',
    amount: 10000 
  }
];

const result = await quick.sendXec(recipients);
console.log('Success! txid:', result.txid); 