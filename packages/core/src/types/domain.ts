export interface Categoria {
  id: string;
  nombre: string;
  color: string;
}

export interface Gasto {
  id: string;
  monto: number;
  descripcion: string;
  categoriaId: string;
  fecha: string;
  createdAt: string;
}

export interface Presupuesto {
  id: string;
  categoriaId: string;
  montoLimite: number;
  mes: string;
}
