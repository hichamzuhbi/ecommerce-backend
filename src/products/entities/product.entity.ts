import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { CartItem } from '../../cart/entities/cart-item.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  comparePrice: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ unique: true })
  sku: string;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value?: string[] | null) => {
        if (!value || value.length === 0) {
          return null;
        }

        return JSON.stringify(value);
      },
      from: (value?: string | null) => {
        if (!value) {
          return [];
        }

        try {
          const parsedValue: unknown = JSON.parse(value);

          if (Array.isArray(parsedValue)) {
            return parsedValue.filter(
              (item): item is string => typeof item === 'string',
            );
          }
        } catch {
          return value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        }

        return [];
      },
    },
  })
  imageUrls: string[];

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => CartItem, (cartItem) => cartItem.product)
  cartItems: CartItem[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
