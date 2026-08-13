import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { Prisma } from '@prisma/client';

export class ProductionService {
  // -------------------------------------------------------------
  // RECIPES & BILL OF MATERIALS (BOM)
  // -------------------------------------------------------------

  public static async getRecipes(
    companyId: string,
    params: { search?: string; isActive?: boolean; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RecipeWhereInput = {
      companyId,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { finishedItem: { name: { contains: params.search, mode: 'insensitive' } } }
            ]
          }
        : {})
    };

    const [total, recipes] = await Promise.all([
      prisma.recipe.count({ where }),
      prisma.recipe.findMany({
        where,
        include: {
          finishedItem: {
            include: {
              unit: { select: { symbol: true } },
              category: { select: { name: true } }
            }
          },
          ingredients: {
            include: {
              rawItem: {
                include: {
                  unit: { select: { symbol: true } }
                }
              },
              unit: { select: { symbol: true } }
            }
          },
          _count: { select: { productionOrders: true } }
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      })
    ]);

    // Compute live estimated recipe cost
    const recipesWithCost = recipes.map((recipe) => {
      const totalCost = recipe.ingredients.reduce((sum, ing) => {
        const itemCost = ing.rawItem.costPrice || new Prisma.Decimal(0);
        return sum.plus(ing.quantity.times(itemCost));
      }, new Prisma.Decimal(0));

      const unitCost = recipe.yieldQty.isZero()
        ? totalCost
        : totalCost.dividedBy(recipe.yieldQty);

      return {
        ...recipe,
        estimatedTotalCost: totalCost,
        estimatedUnitCost: unitCost
      };
    });

    return {
      recipes: recipesWithCost,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public static async getRecipeById(companyId: string, id: string) {
    const recipe = await prisma.recipe.findFirst({
      where: { id, companyId },
      include: {
        finishedItem: {
          include: {
            unit: true,
            category: true
          }
        },
        ingredients: {
          include: {
            rawItem: {
              include: {
                unit: true,
                category: true,
                stockBalances: {
                  include: { warehouse: true }
                }
              }
            },
            unit: true
          }
        }
      }
    });

    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }

    const totalCost = recipe.ingredients.reduce((sum, ing) => {
      return sum.plus(ing.quantity.times(ing.rawItem.costPrice));
    }, new Prisma.Decimal(0));

    const unitCost = recipe.yieldQty.isZero() ? totalCost : totalCost.dividedBy(recipe.yieldQty);

    return {
      ...recipe,
      estimatedTotalCost: totalCost,
      estimatedUnitCost: unitCost
    };
  }

  public static async createRecipe(
    companyId: string,
    data: {
      finishedItemId: string;
      name: string;
      code: string;
      description?: string;
      yieldQty?: number;
      preparationMinutes?: number;
      instructions?: string;
      ingredients: Array<{ rawItemId: string; quantity: number; unitId?: string; notes?: string }>;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.recipe.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Recipe code "${data.code}" already exists`, 400);
    }

    const finishedItem = await prisma.item.findFirst({
      where: { id: data.finishedItemId, companyId }
    });
    if (!finishedItem) {
      throw new AppError('Finished good item not found', 404);
    }

    const yieldQty = new Prisma.Decimal(data.yieldQty || 1);

    const recipe = await prisma.recipe.create({
      data: {
        companyId,
        finishedItemId: data.finishedItemId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        yieldQty,
        preparationMinutes: data.preparationMinutes || 15,
        instructions: data.instructions,
        ingredients: {
          create: data.ingredients.map((ing) => ({
            rawItemId: ing.rawItemId,
            quantity: new Prisma.Decimal(ing.quantity),
            unitId: ing.unitId || null,
            notes: ing.notes
          }))
        }
      },
      include: {
        finishedItem: true,
        ingredients: { include: { rawItem: true } }
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'RECIPE_CREATE',
      entity: 'Recipe',
      entityId: recipe.id,
      details: { name: recipe.name, code: recipe.code, finishedItem: finishedItem.name },
      ipAddress,
      userAgent
    });

    return recipe;
  }

  public static async updateRecipe(
    companyId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      description: string;
      yieldQty: number;
      preparationMinutes: number;
      instructions: string;
      isActive: boolean;
      ingredients: Array<{ rawItemId: string; quantity: number; unitId?: string; notes?: string }>;
    }>,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.recipe.findFirst({
      where: { id, companyId },
      include: { ingredients: true }
    });
    if (!existing) {
      throw new AppError('Recipe not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      if (data.ingredients) {
        await tx.recipeItem.deleteMany({ where: { recipeId: id } });
        await tx.recipeItem.createMany({
          data: data.ingredients.map((ing) => ({
            recipeId: id,
            rawItemId: ing.rawItemId,
            quantity: new Prisma.Decimal(ing.quantity),
            unitId: ing.unitId || null,
            notes: ing.notes
          }))
        });
      }

      const updated = await tx.recipe.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.code ? { code: data.code.toUpperCase() } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.yieldQty ? { yieldQty: new Prisma.Decimal(data.yieldQty) } : {}),
          ...(data.preparationMinutes ? { preparationMinutes: data.preparationMinutes } : {}),
          ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
        },
        include: {
          finishedItem: true,
          ingredients: { include: { rawItem: true } }
        }
      });

      await AuditService.log({
        userId: actorId,
        action: 'RECIPE_UPDATE',
        entity: 'Recipe',
        entityId: id,
        details: { before: existing.code, after: updated.code },
        ipAddress,
        userAgent
      });

      return updated;
    }, { maxWait: 10000, timeout: 30000 });
  }

  // -------------------------------------------------------------
  // PREVIEW PRODUCTION CONSUMPTION & INGREDIENT AVAILABILITY
  // -------------------------------------------------------------

  public static async previewProduction(
    companyId: string,
    recipeId: string,
    plannedQty: number,
    kitchenWarehouseId: string
  ) {
    const [recipe, warehouse] = await Promise.all([
      prisma.recipe.findFirst({
        where: { id: recipeId, companyId },
        include: {
          finishedItem: { include: { unit: true } },
          ingredients: {
            include: {
              rawItem: {
                include: {
                  unit: true,
                  stockBalances: {
                    where: { warehouseId: kitchenWarehouseId }
                  }
                }
              },
              unit: true
            }
          }
        }
      }),
      prisma.warehouse.findFirst({
        where: { id: kitchenWarehouseId, companyId }
      })
    ]);

    if (!recipe || !warehouse) {
      throw new AppError('Invalid recipe or kitchen warehouse', 404);
    }

    const orderQty = new Prisma.Decimal(plannedQty);
    const multiplier = orderQty.dividedBy(recipe.yieldQty);

    let totalEstimatedRawCost = new Prisma.Decimal(0);
    let allIngredientsAvailable = true;

    const ingredientPreview = recipe.ingredients.map((ing) => {
      const standardRequiredQty = ing.quantity.times(multiplier);
      const stockBalance = ing.rawItem.stockBalances[0]?.quantity || new Prisma.Decimal(0);
      const isAvailable = stockBalance.greaterThanOrEqualTo(standardRequiredQty);

      if (!isAvailable) {
        allIngredientsAvailable = false;
      }

      const cost = standardRequiredQty.times(ing.rawItem.costPrice);
      totalEstimatedRawCost = totalEstimatedRawCost.plus(cost);

      return {
        rawItemId: ing.rawItem.id,
        rawItemName: ing.rawItem.name,
        rawItemCode: ing.rawItem.code,
        unitSymbol: ing.unit?.symbol || ing.rawItem.unit.symbol,
        standardRequiredQty,
        currentStockInKitchen: stockBalance,
        isAvailable,
        shortageQty: isAvailable ? new Prisma.Decimal(0) : standardRequiredQty.minus(stockBalance),
        unitCost: ing.rawItem.costPrice,
        totalCost: cost
      };
    });

    const unitFoodCost = orderQty.isZero()
      ? totalEstimatedRawCost
      : totalEstimatedRawCost.dividedBy(orderQty);

    return {
      recipe: {
        id: recipe.id,
        name: recipe.name,
        code: recipe.code,
        finishedItem: recipe.finishedItem.name,
        standardYield: recipe.yieldQty
      },
      plannedQty: orderQty,
      kitchenWarehouse: {
        id: warehouse.id,
        name: warehouse.name
      },
      allIngredientsAvailable,
      totalEstimatedRawCost,
      estimatedUnitFoodCost: unitFoodCost,
      ingredients: ingredientPreview
    };
  }

  // -------------------------------------------------------------
  // PRODUCTION EXECUTION (ATOMIC CONSUMPTION & FINISHED GOOD YIELD)
  // -------------------------------------------------------------

  public static async executeProductionOrder(params: {
    companyId: string;
    branchId: string;
    kitchenWarehouseId: string;
    recipeId: string;
    plannedQty: number;
    actualYieldQty: number;
    wastageQty?: number;
    plannedDate?: string;
    notes?: string;
    actorId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const {
      companyId,
      branchId,
      kitchenWarehouseId,
      recipeId,
      plannedQty,
      actualYieldQty,
      wastageQty = 0,
      plannedDate,
      notes,
      actorId,
      ipAddress,
      userAgent
    } = params;

    const [recipe, warehouse] = await Promise.all([
      prisma.recipe.findFirst({
        where: { id: recipeId, companyId },
        include: {
          finishedItem: true,
          ingredients: {
            include: { rawItem: true }
          }
        }
      }),
      prisma.warehouse.findFirst({
        where: { id: kitchenWarehouseId, companyId }
      })
    ]);

    if (!recipe || !warehouse) {
      throw new AppError('Invalid recipe or kitchen warehouse', 404);
    }

    const orderPlannedQty = new Prisma.Decimal(plannedQty);
    const orderYieldQty = new Prisma.Decimal(actualYieldQty);
    const orderWastageQty = new Prisma.Decimal(wastageQty);

    if (orderPlannedQty.isZero() || orderPlannedQty.isNegative()) {
      throw new AppError('Planned quantity must be greater than zero', 400);
    }
    if (orderYieldQty.isZero() || orderYieldQty.isNegative()) {
      throw new AppError('Actual yield quantity must be greater than zero', 400);
    }

    // Execute in Atomic Transaction
    return prisma.$transaction(async (tx) => {
      const orderCount = await tx.productionOrder.count({ where: { companyId } });
      const orderNumber = `PROD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

      const multiplier = orderPlannedQty.dividedBy(recipe.yieldQty);
      let totalRawCost = new Prisma.Decimal(0);

      // 1. Verify stock availability for ALL raw ingredients before making any deduction (Negative Stock Prevention)
      for (const ing of recipe.ingredients) {
        const requiredQty = ing.quantity.times(multiplier);

        const currentStock = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: kitchenWarehouseId,
              itemId: ing.rawItemId
            }
          }
        });

        if (!currentStock || currentStock.quantity.lessThan(requiredQty)) {
          const available = currentStock ? currentStock.quantity.toString() : '0';
          throw new AppError(
            `Insufficient raw material "${ing.rawItem.name}" in kitchen. Available: ${available}, Required: ${requiredQty}`,
            400
          );
        }
      }

      // 2. Create Production Order Header
      const productionOrder = await tx.productionOrder.create({
        data: {
          companyId,
          branchId,
          kitchenWarehouseId,
          recipeId,
          orderNumber,
          plannedQty: orderPlannedQty,
          actualYieldQty: orderYieldQty,
          wastageQty: orderWastageQty,
          status: 'COMPLETED',
          plannedDate: plannedDate ? new Date(plannedDate) : new Date(),
          completedDate: new Date(),
          notes,
          createdById: actorId
        }
      });

      // 3. Deduct each raw ingredient from kitchen stock & log consumption
      for (const ing of recipe.ingredients) {
        const consumedQty = ing.quantity.times(multiplier);
        const unitCost = ing.rawItem.costPrice;
        const lineTotalCost = consumedQty.times(unitCost);
        totalRawCost = totalRawCost.plus(lineTotalCost);

        // Deduct from stock balance
        const updatedBalance = await tx.stockBalance.update({
          where: {
            warehouseId_itemId: {
              warehouseId: kitchenWarehouseId,
              itemId: ing.rawItemId
            }
          },
          data: {
            quantity: { decrement: consumedQty }
          }
        });

        // Record Production Consumption line
        await tx.productionConsumption.create({
          data: {
            productionOrderId: productionOrder.id,
            rawItemId: ing.rawItemId,
            standardQty: consumedQty,
            actualConsumedQty: consumedQty,
            unitCost,
            totalCost: lineTotalCost
          }
        });

        // Create StockLedger entry for PRODUCTION_OUT
        await tx.stockLedger.create({
          data: {
            warehouseId: kitchenWarehouseId,
            itemId: ing.rawItemId,
            movementType: 'PRODUCTION_OUT',
            changeQty: consumedQty.negated(),
            balanceQty: updatedBalance.quantity,
            unitCost,
            totalCost: lineTotalCost,
            referenceType: 'PRODUCTION',
            referenceId: productionOrder.id,
            notes: `Consumed for ${recipe.name} (${orderNumber})`,
            createdById: actorId
          }
        });
      }

      // 4. Calculate actual unit Food Cost and update Finished Good Item Cost Price (Section 9)
      const unitFoodCost = orderYieldQty.isZero()
        ? totalRawCost
        : totalRawCost.dividedBy(orderYieldQty);

      await tx.productionOrder.update({
        where: { id: productionOrder.id },
        data: {
          totalRawCost,
          unitFoodCost
        }
      });

      await tx.item.update({
        where: { id: recipe.finishedItemId },
        data: {
          costPrice: unitFoodCost
        }
      });

      // 5. Increase Finished Good stock in Kitchen Warehouse & create StockLedger entry
      const finishedStock = await tx.stockBalance.upsert({
        where: {
          warehouseId_itemId: {
            warehouseId: kitchenWarehouseId,
            itemId: recipe.finishedItemId
          }
        },
        update: {
          quantity: { increment: orderYieldQty }
        },
        create: {
          warehouseId: kitchenWarehouseId,
          itemId: recipe.finishedItemId,
          quantity: orderYieldQty
        }
      });

      await tx.stockLedger.create({
        data: {
          warehouseId: kitchenWarehouseId,
          itemId: recipe.finishedItemId,
          movementType: 'PRODUCTION_IN',
          changeQty: orderYieldQty,
          balanceQty: finishedStock.quantity,
          unitCost: unitFoodCost,
          totalCost: totalRawCost,
          referenceType: 'PRODUCTION',
          referenceId: productionOrder.id,
          notes: `Produced from ${recipe.name} (${orderNumber}). Wastage: ${orderWastageQty}`,
          createdById: actorId
        }
      });

      await AuditService.log({
        userId: actorId,
        action: 'PRODUCTION_ORDER_COMPLETED',
        entity: 'ProductionOrder',
        entityId: productionOrder.id,
        details: {
          orderNumber,
          recipe: recipe.name,
          yieldQty: orderYieldQty.toString(),
          unitFoodCost: unitFoodCost.toString(),
          totalCost: totalRawCost.toString()
        },
        ipAddress,
        userAgent
      });

      return {
        ...productionOrder,
        totalRawCost,
        unitFoodCost
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getProductionOrders(
    companyId: string,
    params: { branchId?: string; kitchenWarehouseId?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionOrderWhereInput = {
      companyId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.kitchenWarehouseId ? { kitchenWarehouseId: params.kitchenWarehouseId } : {})
    };

    const [total, orders] = await Promise.all([
      prisma.productionOrder.count({ where }),
      prisma.productionOrder.findMany({
        where,
        include: {
          recipe: {
            include: {
              finishedItem: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } }
            }
          },
          kitchenWarehouse: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          consumptions: {
            include: {
              rawItem: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
