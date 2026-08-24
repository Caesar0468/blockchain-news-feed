const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: { 'User-Agent': 'Blockchain-Security-News-Aggregator/1.0' },
  timeout: 10000,
});

// Edit this list as needed.
// These are more technical/security-focused sources.
const TARGET_FEEDS = [
  {
    name: 'Ethereum Foundation',
    category: 'Protocol Development',
    type: 'blockchain',
    url: 'https://blog.ethereum.org/feed.xml'
  },
  {
    name: 'Trail of Bits',
    category: 'Security Research',
    type: 'cybersecurity',
    url: 'https://blog.trailofbits.com/feed/'
  },
  {
    name: 'Zero Day Initiative',
    category: 'Vulnerability Research',
    type: 'cybersecurity',
    url: 'https://www.zerodayinitiative.com/rss/published/'
  },
  {
    name: 'Hack The Box',
    category: 'Threat Intelligence',
    type: 'cybersecurity',
    url: 'https://www.hackthebox.com/rss/blog/threat-intelligence'
  },
  {
    name: 'Project Zero',
    category: 'Vulnerability Research',
    type: 'cybersecurity',
    url: 'https://googleprojectzero.blogspot.com/feeds/posts/default'
  },
  {
    name: 'Immunefi',
    category: 'Web3 Bug Bounty',
    type: 'blockchain',
    url: 'https://immunefi.com/blog/feed/'
  },
  {
    name: 'The Defiant',
    category: 'DeFi & Web3',
    type: 'blockchain',
    url: 'https://thedefiant.io/feed/'
  },
  {
    name: 'The Hacker News',
    category: 'Cybersecurity News',
    type: 'cybersecurity',
    url: 'https://feeds.feedburner.com/TheHackersNews'
  },
  {
    name: 'PortSwigger Research',
    category: 'Web Security',
    type: 'cybersecurity',
    url: 'https://portswigger.net/research/rss'
  }
];

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Retry ${attempt}/${retries} for ${url} after error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

function isValidItem(item) {
  return (
    item &&
    typeof item.title === 'string' &&
    typeof item.link === 'string' &&
    typeof item.pubDate === 'string'
  );
}

async function runIngestion() {
  const aggregatedEntries = [];
  const sourcesSucceeded = [];
  const sourcesFailed = [];

  for (const source of TARGET_FEEDS) {
    try {
      console.log(`Fetching ${source.name}...`);
      const feed = await fetchWithRetry(source.url);

  const items = feed.items.slice(0, 5).map(item => ({
    title: item.title ? item.title.trim() : 'Untitled',
    link: item.link ? item.link.trim() : '#',
    pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    source: source.name,
    category: source.category,
    type: source.type,
    summary: item.contentSnippet
      ? item.contentSnippet.slice(0, 160).replace(/\s+/g, ' ').trim() + '...'
      : ''
  }));

      aggregatedEntries.push(...items);
      sourcesSucceeded.push(source.name);
      console.log(`  -> ${items.length} items retrieved`);
    } catch (err) {
      console.error(`Failed to fetch ${source.name}: ${err.message}`);
      sourcesFailed.push({ name: source.name, error: err.message });
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

  // Basic schema validation
  if (!Array.isArray(finalItems)) throw new Error('Aggregated items must be an array');
  for (const item of finalItems) {
    if (!isValidItem(item)) {
      throw new Error('Invalid item found in final payload');
    }
  }

  const outputPayload = {
    lastUpdated: new Date().toISOString(),
    sources: {
      succeeded: sourcesSucceeded,
      failed: sourcesFailed
    },
    items: finalItems
  };

  const outputPath = path.join(__dirname, '../data/news.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2));

  console.log(`Saved ${finalItems.length} unique articles to ${outputPath}`);
  console.log(`Sources succeeded: ${sourcesSucceeded.length}`);
  console.log(`Sources failed: ${sourcesFailed.length}`);
}

runIngestion();
