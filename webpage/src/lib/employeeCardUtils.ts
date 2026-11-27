export interface EmployeeCard {
  employeeId: string;
  name: string;
  department: string;
  title: string;
  profileImage: string;
  cardExpirationDate: string;
  email?: string;
}

export const employeeCardData: EmployeeCard[] = [
  {
    employeeId: 'THEA-UWIS',
    name: 'Thiri Chan Nyein',
    department: 'Business Development',
    title: 'Client Acquisition & Solutions Lead',
    profileImage: '',
    cardExpirationDate: '2027-12-31',
    email: 'thirichannyein@theasolutions.co',
  },
  {
    employeeId: 'THEA-CSWE',
    name: 'Chue Yamin Lwin',
    department: 'Business Development',
    title: 'Business Analyst',
    profileImage: '',
    cardExpirationDate: '2027-12-31',
    email: 'chueyaminlwin@theasolutions.co',
  },
];

export function generateEmployeeId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return `THEA-${randomPart}`;
}

export function getEmployeeCardById(employeeId: string): EmployeeCard | undefined {
  return employeeCardData.find((emp: EmployeeCard) => emp.employeeId === employeeId);
}

export function isCardValid(expirationDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(expirationDate);
  return expiration >= today;
}

export function getVerificationStatus(expirationDate: string): 'verified' | 'expired' {
  return isCardValid(expirationDate) ? 'verified' : 'expired';
}
