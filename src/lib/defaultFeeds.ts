export interface DefaultFeed {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

export const defaultFeeds: DefaultFeed[] = [
  {
    name: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews',
    category: 'News',
    enabled: true,
  },
  {
    name: 'BleepingComputer',
    url: 'https://www.bleepingcomputer.com/feed/',
    category: 'News',
    enabled: true,
  },
  {
    name: 'JPCERT/CC',
    url: 'https://www.jpcert.or.jp/rss/jpcert.rdf',
    category: 'Alert',
    enabled: true,
  },
  {
    name: 'CISA Advisories',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    category: 'Alert',
    enabled: true,
  },
  {
    name: 'Krebs on Security',
    url: 'https://krebsonsecurity.com/feed/',
    category: 'Blog',
    enabled: true,
  },
];
