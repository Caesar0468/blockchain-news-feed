const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: { 'User-Agent': 'Blockchain-Security-News-Aggregator/1.0' },
  timeout: 10000,
});

// Edit this list to add/remove sources
const TARGET_FEEDS = [
  {
    name: 'Ethereum Foundation',
    category: 'Protocol Development',
    url: 'https://blog.ethereum.org/feed.xml'
  },
  {
    name: 'Consensys',
    category: 'Web3 & Enterprise',
    url: 'https://consensys.io/rssfeeds'
  },
  {
    name: 'Zero Day Initiative',
    category: 'Vulnerability Research',
    url: 'https://www.zerodayinitiative.com/rss/published/'
  },
  {
    name: 'Hack The Box',
    category: 'Threat Intelligence',
    url: 'https://www.hackthebox.com/rss/blog/threat-intelligence'
  },
  {
    name: 'CoinDesk',
    category: 'Blockchain Industry',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml'
  },
  {
    name: 'The Defiant',
    category: 'DeFi & Smart Contracts',
    url: 'https://thedefiant.io/feed/'
  }
];

async function runIngestion() {
  const aggregatedEntries = [];

  for (const source of TARGET_FEEDS) {
    try {
      console.log(`Fetching ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, 5).map(item => ({
        title: item.title ? item.title.trim() : 'Untitled',
        link: item.link ? item.link.trim() : '#',
        pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source: source.name,
        category: source.category,
        summary: item.contentSnippet
          ? item.contentSnippet.slice(0, 160).replace(/\s+/g, ' ').trim() + '...'
          : ''
      }));
      aggregatedEntries.push(...items);
      console.log(`  -> ${items.length} items retrieved`);
    } catch (err) {
      console.error(`Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  // Sort by publication date (newest first)
  aggregatedEntries.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Remove duplicate links
  const uniqueEntries = Array.from(
    new Map(aggregatedEntries.map(entry => [entry.link, entry])).values()
  );

  // Keep the 25 most recent items
  const finalItems = uniqueEntries.slice(0, 25);

  const outputPath = path.join(__dirname, '../data/news.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2));

  console.log(`Saved ${finalItems.length} unique articles to ${outputPath}`);
}

runIngestion();
