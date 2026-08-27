import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;
const Base = ({ children, ...props }: Props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;

export const ClockIcon = (props: Props) => <Base {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Base>;
export const ScanIcon = (props: Props) => <Base {...props}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></Base>;
export const UserIcon = (props: Props) => <Base {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Base>;
export const ReportIcon = (props: Props) => <Base {...props}><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></Base>;
export const ArrowIcon = (props: Props) => <Base {...props}><path d="m15 18-6-6 6-6"/></Base>;
export const RefreshIcon = (props: Props) => <Base {...props}><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2M6 15a7 7 0 0 0 12 2"/></Base>;
export const CheckIcon = (props: Props) => <Base {...props}><path d="m5 12 4 4L19 6"/></Base>;
export const ReceiptIcon = (props: Props) => <Base {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></Base>;
export const ShieldIcon = (props: Props) => <Base {...props}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></Base>;
export const CameraIcon = (props: Props) => <Base {...props}><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="4"/></Base>;
export const CloseIcon = (props: Props) => <Base {...props}><path d="m6 6 12 12M18 6 6 18"/></Base>;
export const PrintIcon = (props: Props) => <Base {...props}><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></Base>;
export const EyeIcon = (props: Props) => <Base {...props}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Base>;
export const MailIcon = (props: Props) => <Base {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Base>;
