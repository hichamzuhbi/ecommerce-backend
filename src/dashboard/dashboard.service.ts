import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User, UserRole } from '../users/entities/user.entity';

interface RevenueByDayItem {
  date: string;
  revenue: number;
}

interface OrdersByStatusItem {
  status: string;
  count: number;
}

interface LowStockProductItem {
  id: string;
  name: string;
  stock: number;
  sku: string;
}

interface RecentOrderItem {
  id: string;
  customerName: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export interface DashboardStatsResponse {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
  };
  revenueByDay: RevenueByDayItem[];
  ordersByStatus: OrdersByStatusItem[];
  lowStockProducts: LowStockProductItem[];
  recentOrders: RecentOrderItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getStats(): Promise<DashboardStatsResponse> {
    const [
      totalRevenueRaw,
      totalOrders,
      totalProducts,
      totalCustomers,
      paidOrdersLast7Days,
      ordersByStatusRaw,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .select('COALESCE(SUM(order.totalAmount), 0)', 'totalRevenue')
        .where('order.paymentStatus = :paymentStatus', {
          paymentStatus: PaymentStatus.PAID,
        })
        .getRawOne<{ totalRevenue: string }>(),
      this.ordersRepository.count(),
      this.productsRepository.count(),
      this.usersRepository.count({ where: { role: UserRole.CUSTOMER } }),
      this.getPaidOrdersForLast7Days(),
      this.ordersRepository
        .createQueryBuilder('order')
        .select('order.status', 'status')
        .addSelect('COUNT(order.id)', 'count')
        .groupBy('order.status')
        .getRawMany<{ status: string; count: string }>(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.stock <= :maxStock', { maxStock: 10 })
        .orderBy('product.stock', 'ASC')
        .getMany(),
      this.ordersRepository.find({
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    const revenueByDay = this.buildRevenueByDay(paidOrdersLast7Days);

    return {
      kpis: {
        totalRevenue: Number(totalRevenueRaw?.totalRevenue ?? 0),
        totalOrders,
        totalProducts,
        totalCustomers,
      },
      revenueByDay,
      ordersByStatus: ordersByStatusRaw.map((item) => ({
        status: item.status,
        count: Number(item.count),
      })),
      lowStockProducts: lowStockProducts
        .filter((product) => product.stock <= 10)
        .map((product) => ({
          id: product.id,
          name: product.name,
          stock: product.stock,
          sku: product.sku,
        })),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        total: Number(order.totalAmount),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  private async getPaidOrdersForLast7Days(): Promise<Order[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    return this.ordersRepository
      .createQueryBuilder('order')
      .where('order.paymentStatus = :paymentStatus', {
        paymentStatus: PaymentStatus.PAID,
      })
      .andWhere('order.createdAt >= :startDate', {
        startDate: startDate.toISOString(),
      })
      .getMany();
  }

  private buildRevenueByDay(orders: Order[]): RevenueByDayItem[] {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
    });

    const days: { key: string; label: string }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      days.push({
        key: date.toISOString().slice(0, 10),
        label: dateFormatter.format(date),
      });
    }

    const totalsByDate = new Map<string, number>();

    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const current = totalsByDate.get(key) ?? 0;
      totalsByDate.set(key, current + Number(order.totalAmount));
    }

    return days.map((day) => ({
      date: day.label,
      revenue: Number((totalsByDate.get(day.key) ?? 0).toFixed(2)),
    }));
  }
}
