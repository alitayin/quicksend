import { ChronikClient } from "chronik-client";

// Define multiple Chronik nodes
const chronikUrls: string[] = [
    'https://chronik-native2.fabien.cash',
    'https://chronik-native3.fabien.cash',
    'https://chronik.pay2stay.com/xec2',
    'https://chronik-native1.fabien.cash',
    'https://chronik1.alitayin.com',
    'https://chronik2.alitayin.com',
];

// Create shared ChronikClient instance supporting multiple nodes
const chronik: ChronikClient = new ChronikClient(chronikUrls);

export { chronik }; 