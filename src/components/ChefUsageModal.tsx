import React from 'react';
import { ChefAccountsCostingWorkflow } from './ChefAccountsCostingWorkflow';
import { 
  BookingEvent, 
  RecipeMenuItem, 
  RawIngredient, 
  ChefUsageItem, 
  UserProfile, 
  ChefPartyIngredientEntry, 
  CostingMethod, 
  CostingWorkflowStatus 
} from '../types';

interface ChefUsageModalProps {
  booking: BookingEvent;
  recipes: RecipeMenuItem[];
  ingredients: RawIngredient[];
  currentUser?: UserProfile;
  allUsers?: UserProfile[];
  onClose: () => void;
  onSave?: (bookingId: string, logs: ChefUsageItem[], actualCost: number, notes: string) => void;
  onSaveCosting?: (
    bookingId: string, 
    entries: ChefPartyIngredientEntry[], 
    method: CostingMethod, 
    status: CostingWorkflowStatus, 
    actualCost: number, 
    chefNotes: string, 
    arunNotes: string
  ) => void;
  onOpenA4Sheet?: (booking: BookingEvent) => void;
}

export const ChefUsageModal: React.FC<ChefUsageModalProps> = ({
  booking,
  recipes,
  ingredients,
  currentUser = {
    id: 'user_chef',
    name: 'Chef Karim Zayani',
    role: 'executive_chef',
    title: 'Executive Head Chef',
    email: 'chef.karim@crystalplazahotel.com',
    avatar: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=150&auto=format&fit=crop&q=80',
    pin: '2345',
    permissions: {
      canViewProfits: true,
      canEditPricing: false,
      canManageBookings: false,
      canManageRecipes: true,
      canLogChefUsage: true,
      canManageInventory: true,
      canGenerateInvoices: false,
      canAccessBackups: false,
      canManageUsers: false,
    },
  },
  allUsers = [],
  onClose,
  onSave,
  onSaveCosting,
  onOpenA4Sheet,
}) => {
  const handleSaveCosting = (
    bookingId: string,
    entries: ChefPartyIngredientEntry[],
    method: CostingMethod,
    status: CostingWorkflowStatus,
    actualCost: number,
    chefNotes: string,
    arunNotes: string
  ) => {
    if (onSaveCosting) {
      onSaveCosting(bookingId, entries, method, status, actualCost, chefNotes, arunNotes);
    } else if (onSave) {
      // Map to legacy format if needed
      const legacyLogs: ChefUsageItem[] = entries.map((e, idx) => ({
        ingredientId: e.id || `ing_${idx}`,
        ingredientName: e.ingredient,
        unit: e.purchasingUnit || 'unit',
        theoreticalQuantity: 1,
        actualUsedQuantity: 1,
        unitCost: e.purchasingPriceAED || 0,
        varianceCost: 0,
        varianceReason: e.notes,
      }));
      onSave(bookingId, legacyLogs, actualCost, chefNotes);
    }
  };

  return (
    <ChefAccountsCostingWorkflow
      booking={booking}
      currentUser={currentUser}
      allUsers={allUsers}
      recipes={recipes}
      ingredients={ingredients}
      onClose={onClose}
      onSaveCosting={handleSaveCosting}
      onOpenA4Sheet={onOpenA4Sheet}
    />
  );
};
