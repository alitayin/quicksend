import { ChronikClient } from "chronik-client";

// 定义多个Chronik节点
const chronikUrls: string[] = [
    'https://chronik-native2.fabien.cash',
    'https://chronik-native3.fabien.cash',
    'https://chronik.pay2stay.com/xec2',
    'https://chronik-native1.fabien.cash',
    'https://chronik1.alitayin.com',
    'https://chronik2.alitayin.com',
];

// 创建共享的Chronik客户端实例，支持多个节点
const chronik: ChronikClient = new ChronikClient(chronikUrls);

export { chronik }; 