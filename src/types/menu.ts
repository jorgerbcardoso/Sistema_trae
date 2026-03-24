export interface MenuItem {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  route_path: string;
  display_order: number;
  is_active: boolean;
  is_available: boolean;
  status: string;
  status_message?: string | null;
  ordem?: number;
}

export interface MenuSection {
  section: {
    id: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    display_order: number;
    is_active: boolean;
  };
  items: MenuItem[];
}
