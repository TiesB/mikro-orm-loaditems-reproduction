import {
  Collection,
  Entity,
  OneToMany,
  MikroORM,
  PrimaryKey,
  Property,
  ManyToOne,
  ManyToMany,
} from "@mikro-orm/sqlite";

@Entity()
export class Project {
  @PrimaryKey()
  public id!: number;

  @OneToMany(() => MeasureFilter, (measureFilter) => measureFilter.project)
  public measureFilters = new Collection<MeasureFilter>(this);

  @OneToMany(() => Risk, (risk) => risk.project)
  public risks = new Collection<Risk>(this);
}

@Entity()
class Risk {
  @PrimaryKey()
  public id!: number;

  @Property()
  public name!: string;

  @OneToMany(() => Cause, (cause) => cause.risk)
  public causes = new Collection<Cause>(this);

  @ManyToMany(() => Measure, (measure) => measure.risks, {
    owner: true,
    eager: true,
  })
  public measures = new Collection<Measure>(this);

  @ManyToOne(() => Project)
  public project!: Project;
}

@Entity()
class Cause {
  @PrimaryKey()
  public id!: number;

  @ManyToOne(() => Risk)
  public risk!: Risk;

  @ManyToMany(() => Measure, (measure) => measure.causes)
  public measures = new Collection<Measure>(this);
}

@Entity()
class Measure {
  @PrimaryKey()
  public id!: number;

  @ManyToMany(() => Risk, (r) => r.measures, { eager: true })
  public risks = new Collection<Risk>(this);

  @ManyToMany(() => Cause, (cause) => cause.measures, { owner: true })
  public causes = new Collection<Cause>(this);

  @ManyToMany(
    () => MeasureFilterValue,
    (measureFilterValue) => measureFilterValue.measures,
    {
      owner: true,
    }
  )
  public measureFilterValues = new Collection<MeasureFilterValue>(this);
}

@Entity()
export class MeasureFilter {
  @PrimaryKey()
  public id!: number;

  @OneToMany(() => MeasureFilterValue, (value) => value.measureFilter)
  public values = new Collection<MeasureFilterValue>(this);

  @ManyToOne(() => Project)
  public project!: Project;
}

@Entity()
export class MeasureFilterValue {
  @PrimaryKey()
  public id!: number;

  @ManyToOne()
  public measureFilter!: MeasureFilter;

  @ManyToMany(() => Measure, (measure) => measure.measureFilterValues)
  public measures = new Collection<Measure>(this);
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [
      Cause,
      Measure,
      MeasureFilter,
      MeasureFilterValue,
      Project,
      Risk,
    ],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

beforeEach(async () => {
  await orm.schema.clearDatabase();
  const project = orm.em.create(Project, {});
  await orm.em.persistAndFlush(project);

  const measureFilter = orm.em.create(MeasureFilter, { project: project.id });
  await orm.em.persistAndFlush(measureFilter);

  const risk = orm.em.create(Risk, {
    name: "TestRisk",
    project: project.id,
  });
  await orm.em.persistAndFlush(risk);

  const cause = orm.em.create(Cause, { risk: risk.id });
  await orm.em.persistAndFlush(cause);

  const measure = orm.em.create(Measure, {
    risks: [risk.id],
    causes: [cause.id],
    measureFilterValues: [{ measureFilter: measureFilter.id }],
  });
  await orm.em.persistAndFlush(measure);

  await orm.em.clear();
});

test('"loadItems()" overwriting unflushed changes', async () => {
  const risk = await orm.em.getRepository(Risk).findOne(1);
  if (!risk) {
    throw new Error();
  }

  expect(risk.name).toBe("TestRisk");

  risk.name = "Updated";
  expect(risk.name).toBe("Updated");

  await risk.causes.loadItems();
  expect(risk.name).toBe("Updated");

  await orm.em.flush();
  expect(risk.name).toBe("Updated");
});
