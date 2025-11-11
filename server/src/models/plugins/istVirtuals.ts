import { Schema, HydratedDocument } from 'mongoose';
import type { IProduct } from '../Product';

const istVirtuals = (schema: Schema<IProduct>) => {
  schema.virtual('id').get(function (this: HydratedDocument<IProduct>) {
    return this._id.toString();
  });

  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.id;
      return ret;
    },
  });
};

export default istVirtuals;
