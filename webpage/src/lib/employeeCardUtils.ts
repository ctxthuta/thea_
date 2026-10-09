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
    employeeId: "THEA-XWUE",
    name: "Dr. Ohnmar Than",
    department: "Finance",
    title: "Chief Financial Officer",
    profileImage: "https://live.staticflickr.com/65535/55577607237_58d09f461e_c.jpg",
    cardExpirationDate: "2027-12-31",
    email: "ohnmarthan@theasolutions.co"
  },
  {
    employeeId: "THEA-UWIS",
    name: "Thiri Chan Nyein",
    department: "Business Development",
    title: "Client Acquisition & Solutions Lead",
    profileImage: "",
    cardExpirationDate: "2027-12-31",
    email: "thirichannyein@theasolutions.co"
  },
  {
    employeeId: "THEA-CSWE",
    name: "Chue Yamin Lwin",
    department: "Business Development",
    title: "Business Analyst",
    profileImage: "",
    cardExpirationDate: "2027-12-31"
  }
];

/**
 * Generate a random THEA-XXXX employee ID
 * Format: THEA- followed by 4 random uppercase letters
 */
export function generateEmployeeId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return `THEA-${randomPart}`;
}

/**
 * Get employee card data by employee ID
 */
export function getEmployeeCardById(employeeId: string): EmployeeCard | undefined {
  return employeeCardData.find((emp: EmployeeCard) => emp.employeeId === employeeId);
}

/**
 * Check if employee card is still valid (not expired)
 */
export function isCardValid(expirationDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  const expiration = new Date(expirationDate);
  return expiration >= today;
}

/**
 * Get verification status based on card expiration
 */
export function getVerificationStatus(expirationDate: string): 'verified' | 'expired' {
  return isCardValid(expirationDate) ? 'verified' : 'expired';
}
