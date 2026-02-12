export interface Task {
  id: number;
  nama: string;
  tugas: string;
  link: string;
  akun: number;
  status: 'Ongoing' | 'END' | 'Nunggu Info' | 'Waitlist';
  selesaiHariIni: boolean;
  tanggalDitambahkan: string;
  kategori: string;
  detailAkun: string[]
  emailUsed?: string;
  xUsed?: string;
  discordUsed?: string;
  walletAddress?: string;
}

export interface Transaction {
  id: number;
  desc: string;
  amount: number;
  type: 'income' | 'expense';
  network: string;
  date: string;
}

export interface FaucetLink {
  url: string;
  text: string;
}

export interface FaucetItem {
  id: string;
  name: string;
  description: string;
  url?: string;
  urlText?: string;
  links?: FaucetLink[];
  color?: string;
  icon?: string;
}

export interface ExportData {
  airdropTasks: Task[];
  financeTransactions: Transaction[];
  encryptedData?: string;
}
