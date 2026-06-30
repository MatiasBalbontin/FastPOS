import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import express from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FastPOS API Documentation',
      version: '1.2.0',
      description: 'Documentación oficial de los endpoints de la API REST del sistema FastPOS v1.2',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local de Desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Autenticación basada en sesión Express (cookie connect.sid)',
        },
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Código de barra o identificador único' },
            name: { type: 'string', description: 'Nombre del producto' },
            type: { type: 'string', description: 'Categoría del producto' },
            sale_price: { type: 'number', description: 'Precio de venta' },
            total_stock: { type: 'number', description: 'Stock total disponible combinando lotes' },
            has_zero_cost: { type: 'boolean', description: 'Si tiene lotes con costo $0' },
            cost: { type: 'number', description: 'Costo unitario de referencia del lote más antiguo' }
          }
        },
        SaleItem: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'Código del producto' },
            quantity: { type: 'integer', description: 'Cantidad a vender' }
          },
          required: ['product_id', 'quantity']
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID autonumérico' },
            first_name: { type: 'string', description: 'Nombre o Razón Social' },
            last_name: { type: 'string', description: 'Apellido (en blanco para empresas)' },
            rut: { type: 'string', description: 'RUT chileno único' },
            address: { type: 'string', description: 'Dirección física' },
            contact: { type: 'string', description: 'Nombre del contacto de la entidad' },
            phone: { type: 'string', description: 'Teléfono de contacto' },
            email: { type: 'string', description: 'Dirección de correo electrónico' },
            type: { type: 'string', enum: ['cliente', 'proveedor', 'ambos'], description: 'Clasificación de entidad' }
          },
          required: ['first_name', 'rut', 'address', 'type']
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            description: { type: 'string', description: 'Glosa descriptiva' },
            amount: { type: 'number', description: 'Monto del gasto' },
            method: { type: 'string', enum: ['cash', 'card'] }
          },
          required: ['description', 'amount', 'method']
        }
      }
    },
    paths: {
      '/api/auth/login': {
        post: {
          summary: 'Iniciar Sesión',
          tags: ['Authentication'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    password: { type: 'string', example: 'admin' }
                  },
                  required: ['password']
                }
              }
            }
          },
          responses: {
            200: { description: 'Login exitoso' },
            401: { description: 'Contraseña incorrecta' }
          }
        }
      },
      '/api/auth/session': {
        get: {
          summary: 'Verificar Sesión Activa',
          tags: ['Authentication'],
          security: [],
          responses: {
            200: {
              description: 'Estado de autenticación del cliente',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      authenticated: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/logout': {
        post: {
          summary: 'Cerrar Sesión',
          tags: ['Authentication'],
          responses: {
            200: { description: 'Sesión destruida y cookies borradas' }
          }
        }
      },
      '/api/products': {
        get: {
          summary: 'Listar Productos',
          tags: ['Products'],
          parameters: [
            { name: 'includeInactive', in: 'query', schema: { type: 'boolean' }, description: 'Incluir productos archivados' }
          ],
          responses: {
            200: {
              description: 'Listado de productos',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Crear o Reemplazar Producto (Upsert)',
          tags: ['Products'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    sale_price: { type: 'number' },
                    initial_stock: { type: 'number' },
                    cost: { type: 'number' }
                  },
                  required: ['id', 'name', 'type', 'sale_price']
                }
              }
            }
          },
          responses: {
            200: { description: 'Producto guardado correctamente' },
            400: { description: 'Payload inválido' }
          }
        }
      },
      '/api/products/{id}': {
        get: {
          summary: 'Obtener un producto específico con sus lotes',
          tags: ['Products'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Detalle del producto y existencias' },
            404: { description: 'Producto no encontrado' }
          }
        },
        put: {
          summary: 'Modificar atributos del producto y stock',
          tags: ['Products'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    sale_price: { type: 'number' },
                    cost: { type: 'number' },
                    new_stock: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Producto actualizado' }
          }
        },
        delete: {
          summary: 'Archivar producto (Soft Delete)',
          tags: ['Products'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Producto archivado' }
          }
        }
      },
      '/api/products/{id}/restore': {
        post: {
          summary: 'Restaurar producto archivado',
          tags: ['Products'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Producto restaurado' }
          }
        }
      },
      '/api/sales/bulk': {
        post: {
          summary: 'Registrar Venta por Lote (Bulk POS)',
          tags: ['Sales'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SaleItem' }
                    },
                    method: { type: 'string', enum: ['cash', 'card', 'cuenta_por_cobrar'] },
                    customer_id: { type: 'integer', nullable: true }
                  },
                  required: ['items', 'method']
                }
              }
            }
          },
          responses: {
            200: { description: 'Venta completada' },
            400: { description: 'Stock insuficiente o parámetros inválidos' }
          }
        }
      },
      '/api/sales/void/{id}': {
        post: {
          summary: 'Anular Venta y Restaurar Stock FIFO',
          tags: ['Sales'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Venta anulada correctamente' }
          }
        }
      },
      '/api/analytics': {
        get: {
          summary: 'Obtener Estadísticas de Rendimiento',
          tags: ['Analytics'],
          parameters: [
            { name: 'startDate', in: 'query', schema: { type: 'string' } },
            { name: 'endDate', in: 'query', schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Métricas e ingresos financieros' }
          }
        }
      },
      '/api/expenses': {
        get: {
          summary: 'Listar Gastos',
          tags: ['Expenses'],
          responses: {
            200: { description: 'Historial de egresos' }
          }
        },
        post: {
          summary: 'Registrar Gasto de Caja',
          tags: ['Expenses'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Expense' }
              }
            }
          },
          responses: {
            200: { description: 'Gasto guardado' }
          }
        }
      },
      '/api/customers': {
        get: {
          summary: 'Listar Clientes y Proveedores (Entidades)',
          tags: ['Entities'],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['cliente', 'proveedor'] } }
          ],
          responses: {
            200: { description: 'Listado de entidades registradas' }
          }
        },
        post: {
          summary: 'Crear Entidad',
          tags: ['Entities'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' }
              }
            }
          },
          responses: {
            200: { description: 'Entidad creada' }
          }
        }
      }
    }
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: express.Express) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
