export interface QrCode {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

export interface CreateQrCodeInput {
  title: string;
  content: string;
}
