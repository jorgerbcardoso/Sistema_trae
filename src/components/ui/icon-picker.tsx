/**
 * ICON PICKER
 * Seletor visual de ícones do lucide-react
 */

import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

// ============================================
// LISTA DE ÍCONES DISPONÍVEIS
// ============================================

export const AVAILABLE_ICONS = [
  'BarChart3',
  'TrendingUp',
  'Package',
  'Truck',
  'Route',
  'DollarSign',
  'FolderPlus',
  'FolderOpen',
  'FileText',
  'FileSpreadsheet',
  'Building2',
  'User',
  'UserPlus',
  'Settings',
  'Shield',
  'Calendar',
  'CheckSquare',
  'RefreshCw',
  'Menu',
  'Home',
  'LayoutDashboard',
  'Boxes',
  'Users',
  'MapPin',
  'Car',
  'Bus',
  'Package2',
  'ClipboardList',
  'FileBarChart',
  'PieChart',
  'Activity',
  'AlertCircle',
  'Archive',
  'Bookmark',
  'BookOpen',
  'Box',
  'Briefcase',
  'Calculator',
  'ClipboardCheck',
  'Cloud',
  'Compass',
  'Database',
  'Download',
  'Edit',
  'Eye',
  'File',
  'Filter',
  'Flag',
  'Folder',
  'Gift',
  'Globe',
  'Grid',
  'Hash',
  'HelpCircle',
  'Inbox',
  'Info',
  'Key',
  'Layers',
  'Link',
  'List',
  'Lock',
  'Mail',
  'Map',
  'MessageSquare',
  'Percent',
  'Phone',
  'Plus',
  'PlusCircle',
  'Printer',
  'Search',
  'Send',
  'Server',
  'ShoppingCart',
  'Sliders',
  'Star',
  'Tag',
  'Target',
  'Trash',
  'TrendingDown',
  'Upload',
  'UserCheck',
  'Wallet',
  'Zap',
] as const;

// ============================================
// COMPONENTE ICON PICKER
// ============================================

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
  className?: string;
}

export function IconPicker({ value, onChange, label, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar ícones baseado na busca
  const filteredIcons = AVAILABLE_ICONS.filter(iconName =>
    iconName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Buscar o componente do ícone selecionado
  const SelectedIcon = (LucideIcons as any)[value] || LucideIcons.HelpCircle;

  return (
    <div className={className}>
      {label && (
        <Label className="text-foreground mb-2 block">
          {label}
        </Label>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start"
          >
            <SelectedIcon className="w-4 h-4 mr-2" />
            <span className="flex-1 text-left">{value}</span>
            <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-[400px] p-0" 
          align="start"
          onWheel={(e) => e.stopPropagation()} // ✅ Permite scroll no popover
        >
          {/* Campo de busca */}
          <div className="p-3 border-b border-border">
            <Input
              placeholder="Buscar ícone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Grid de ícones */}
          <div 
            className="max-h-[300px] overflow-y-auto p-2"
            onWheel={(e) => {
              // ✅ FORÇA o scroll com mousewheel dentro do container
              e.stopPropagation();
            }}
          >
            {filteredIcons.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum ícone encontrado
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {filteredIcons.map((iconName) => {
                  const IconComponent = (LucideIcons as any)[iconName];
                  const isSelected = value === iconName;
                  
                  return (
                    <button
                      key={iconName}
                      onClick={() => {
                        onChange(iconName);
                        setOpen(false);
                        setSearchTerm('');
                      }}
                      className={`
                        flex flex-col items-center justify-center p-3 rounded-lg
                        transition-all hover:bg-accent
                        ${isSelected ? 'bg-primary/10 ring-2 ring-primary' : ''}
                      `}
                      title={iconName}
                    >
                      <IconComponent className="w-5 h-5 text-foreground" />
                      <span className="text-[10px] mt-1 text-muted-foreground truncate w-full text-center">
                        {iconName.slice(0, 8)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Informação do ícone selecionado */}
          <div className="p-3 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <SelectedIcon className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">
                {value}
              </span>
              <span className="text-muted-foreground text-xs ml-auto">
                {filteredIcons.length} de {AVAILABLE_ICONS.length} ícones
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}