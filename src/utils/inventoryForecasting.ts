import { RawIngredient, BookingEvent, RecipeMenuItem } from '../types';

export interface IngredientBookingUsageForecast {
  ingredient: RawIngredient;
  currentStock: number;
  currentSubUnits: number;
  unit: string;
  subUnitName: string;
  packagingUnit: string;
  subUnitsPerPackage: number;
  reorderThreshold: number;
  reorderSubUnits: number;
  
  // Forecast from upcoming scheduled bookings
  totalRequiredUpcoming: number;
  totalRequiredSubUnitsUpcoming: number;
  projectedRemainingStock: number;
  projectedRemainingSubUnits: number;
  
  // Status flags
  isCurrentlyLow: boolean;
  isProjectedDeficit: boolean;
  isProjectedLow: boolean;
  alertSeverity: 'safe' | 'low_warning' | 'critical_deficit';
  
  // Breakdown of which upcoming bookings require this item
  bookingDemands: Array<{
    bookingId: string;
    bookingNumber: string;
    clientName: string;
    eventDate: string;
    guestCount: number;
    hallName: string;
    dishName: string;
    quantityNeeded: number;
    subUnitsNeeded: number;
  }>;
}

/**
 * Calculates real-time remaining quantities after recipes are used for scheduled bookings.
 */
export function calculateInventoryBookingForecasts(
  ingredients: RawIngredient[],
  bookings: BookingEvent[],
  recipes: RecipeMenuItem[],
  todayStr: string = '2026-10-14'
): IngredientBookingUsageForecast[] {
  // 1. Filter for upcoming scheduled bookings with hotel food
  const upcomingBookings = bookings.filter(b => 
    b.eventDate >= todayStr && 
    b.status !== 'cancelled' &&
    b.hasFoodFromHotel
  );

  const recipesMap = new Map<string, RecipeMenuItem>(recipes.map(r => [r.id, r]));

  return ingredients.map(ing => {
    const perPack = ing.subUnitsPerPackage || 1;
    const currentSubUnits = ing.stockSubUnits !== undefined 
      ? ing.stockSubUnits 
      : Math.round(ing.stockQuantity * perPack);
    const currentStock = ing.stockQuantity;
    const reorderSubUnits = ing.reorderSubUnits !== undefined 
      ? ing.reorderSubUnits 
      : ing.reorderLevel * perPack;

    let totalRequiredUpcoming = 0;
    let totalRequiredSubUnits = 0;
    const bookingDemands: IngredientBookingUsageForecast['bookingDemands'] = [];

    upcomingBookings.forEach(booking => {
      const guests = booking.guestCount || 30;
      
      // Look through custom recipe items or recipes matching booking
      const recipeIdsToInspect = (booking.customRecipeItemIds && booking.customRecipeItemIds.length > 0)
        ? booking.customRecipeItemIds
        : recipes.filter(r => {
            // If buffet tier specified, check common inclusions
            if (booking.buffetTier === '60_aed') return ['rec_1', 'rec_2', 'rec_4', 'rec_6'].includes(r.id);
            if (booking.buffetTier === '80_aed') return ['rec_1', 'rec_2', 'rec_3', 'rec_4', 'rec_5', 'rec_6'].includes(r.id);
            return true; // 100 AED or custom
          }).map(r => r.id);

      recipeIdsToInspect.forEach(rId => {
        const recipe = recipesMap.get(rId);
        if (!recipe) return;

        const ingInRecipe = recipe.ingredients.find(ri => 
          ri.ingredientId === ing.id || 
          ri.ingredientName.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(ri.ingredientName.toLowerCase())
        );

        if (ingInRecipe) {
          const qtyNeeded = (ingInRecipe.quantityPerPortion || 0.15) * guests;
          const subUnitsNeeded = Math.round(qtyNeeded * perPack);
          
          totalRequiredUpcoming += qtyNeeded;
          totalRequiredSubUnits += subUnitsNeeded;

          bookingDemands.push({
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            clientName: booking.clientName,
            eventDate: booking.eventDate,
            guestCount: guests,
            hallName: booking.hallName,
            dishName: recipe.name,
            quantityNeeded: parseFloat(qtyNeeded.toFixed(2)),
            subUnitsNeeded: subUnitsNeeded
          });
        }
      });

      // Special rule: If it's chicken or rice and this booking has food, ensure at least standard buffet usage is accounted
      if (ing.name.toLowerCase().includes('chicken') && !bookingDemands.some(d => d.bookingId === booking.id)) {
        // e.g. 1 carton per 25-30 guests
        const cartonsNeeded = parseFloat((guests / 26).toFixed(2));
        const piecesNeeded = guests;
        totalRequiredUpcoming += cartonsNeeded;
        totalRequiredSubUnits += piecesNeeded;
        bookingDemands.push({
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          clientName: booking.clientName,
          eventDate: booking.eventDate,
          guestCount: guests,
          hallName: booking.hallName,
          dishName: 'Banquet Chicken Main (Buffet)',
          quantityNeeded: cartonsNeeded,
          subUnitsNeeded: piecesNeeded
        });
      }
    });

    const projectedRemainingStock = parseFloat((currentStock - totalRequiredUpcoming).toFixed(2));
    const projectedRemainingSubUnits = currentSubUnits - totalRequiredSubUnits;

    const isCurrentlyLow = currentSubUnits <= reorderSubUnits;
    const isProjectedDeficit = projectedRemainingSubUnits < 0;
    const isProjectedLow = projectedRemainingSubUnits <= reorderSubUnits;

    let alertSeverity: 'safe' | 'low_warning' | 'critical_deficit' = 'safe';
    if (isProjectedDeficit) {
      alertSeverity = 'critical_deficit';
    } else if (isProjectedLow || isCurrentlyLow) {
      alertSeverity = 'low_warning';
    }

    return {
      ingredient: ing,
      currentStock,
      currentSubUnits,
      unit: ing.unit,
      subUnitName: ing.subUnitName || 'units',
      packagingUnit: ing.packagingUnit || 'Pack',
      subUnitsPerPackage: perPack,
      reorderThreshold: ing.reorderLevel,
      reorderSubUnits,
      totalRequiredUpcoming: parseFloat(totalRequiredUpcoming.toFixed(2)),
      totalRequiredSubUnitsUpcoming: totalRequiredSubUnits,
      projectedRemainingStock,
      projectedRemainingSubUnits,
      isCurrentlyLow,
      isProjectedDeficit,
      isProjectedLow,
      alertSeverity,
      bookingDemands
    };
  });
}
