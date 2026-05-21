# 图书馆管理系统 数据库设计

## User 表

| 字段名       | 字段类型 | 是否可为空 | 默认值    | 完整性约束                              | 注释             |
| ------------ | -------- | ---------- | --------- | --------------------------------------- | ---------------- |
| id           | String   | 否         | `cuid()`  | primary key                             | 用户唯一标识     |
| name         | String   | 否         | -         | -                                       | 用户姓名         |
| email        | String   | 否         | -         | unique                                  | 登录邮箱         |
| passwordHash | String   | 否         | -         | -                                       | 密码哈希         |
| studentId    | String   | 否         | -         | unique                                  | 学号（仅学生有） |
| role         | Enum     | 否         | `STUDENT` | 枚举：`STUDENT` / `LIBRARIAN` / `ADMIN` | 用户角色         |
| createdAt    | DateTime | 否         | `now()`   | -                                       | 记录创建时间     |

## Book 表

| 字段名          | 字段类型 | 是否可为空 | 默认值   | 完整性约束                                                                                | 注释                                                       |
| --------------- | -------- | ---------- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| id              | String   | 否         | `cuid()` | primary key                                                                               | 图书唯一标识（扫码借书可扫此 id ）                         |
| title           | String   | 否         | -        | 建议索引                                                                                  | 书名                                                       |
| author          | String   | 否         | -        | 建议索引                                                                                  | 作者                                                       |
| isbn            | String   | 否         | -        | unique                                                                                    | ISBN 编号                                                  |
| genre           | String   | 否         | -        | 枚举值：`Technology` / `Fiction` / `Science` / `History` / `Management`；建议索引（筛选） | 图书类别                                                   |
| cover           | String   | 是         | -        | -                                                                                         | 图书封面图片（管理员上传，可存储图片 URL、路径或文件标识） |
| description     | String   | 是         | -        | -                                                                                         | 图书简介                                                   |
| language        | String   | 否         | -        | 枚举值：`Chinese` / `English` / `Others`                                                  | 语言                                                       |
| shelfLocation   | String   | 否         | -        | -                                                                                         | 书架位置                                                   |
| available       | Boolean  | 否         | `true`   | 建议索引                                                                                  | 是否可借                                                   |
| availableCopies | Int      | 否         | `1`      | 逻辑约束：`>= 0`                                                                          | 可借数量；当 `availableCopies = 0` 时表示当前图书不可借    |
| createdAt       | DateTime | 否         | `now()`  | 建议索引                                                                                  | 上架时间（新书通报按此排序）                               |

## Loan 表

| 字段名       | 字段类型 | 是否可为空 | 默认值      | 完整性约束                                              | 注释                                       |
| ------------ | -------- | ---------- | ----------- | ------------------------------------------------------- | ------------------------------------------ |
| id           | String   | 否         | `cuid()`    | primary key                                             | 借阅记录唯一标识                           |
| bookId       | String   | 否         | -           | 外键：引用 `Book(id)`，删除 Book 时级联删除 (`Cascade`) | 对应图书 ID                                |
| userId       | String   | 否         | -           | 外键：引用 `User(id)`，删除 User 时级联删除 (`Cascade`) | 对应借阅人 ID                              |
| checkoutDate | DateTime | 否         | -           | -                                                       | 借出日期                                   |
| dueDate      | DateTime | 否         | -           | -                                                       | 到期日期（默认60天，续借时更新并顺延30天） |
| returnDate   | DateTime | 是         | -           | -                                                       | 实际归还日期（未还则为空）                 |
| fineAmount   | Decimal  | 否         | `0`         | -                                                       | 罚金金额                                   |
| finePaid     | Boolean  | 否         | `false`     | -                                                       | 是否已支付罚金                             |
| fineForgiven | Boolean  | 否         | `false`     | -                                                       | 罚金是否已减免                             |
| renewalCount | Int      | 否         | `0`         | 逻辑约束：最大为 `1`                                    | 续借次数                                   |
| status       | Enum     | 否         | `Borrowing` | 枚举：`Borrowing` / `Returned` / `Overdue`              | 借阅状态                                   |
| createdAt    | DateTime | 否         | `now()`     | -                                                       | 记录创建时间                               |

## Rating 表

| 字段名    | 字段类型 | 是否可为空 | 默认值   | 完整性约束                                              | 注释                                     |
| --------- | -------- | ---------- | -------- | ------------------------------------------------------- | ---------------------------------------- |
| id        | String   | 否         | `cuid()` | primary key                                             | 评分记录唯一标识                         |
| bookId    | String   | 否         | -        | 外键：引用 `Book(id)`，删除 Book 时级联删除 (`Cascade`) | 被评分图书 ID                            |
| userId    | String   | 否         | -        | 外键：引用 `User(id)`，删除 User 时级联删除 (`Cascade`) | 评分用户 ID                              |
| stars     | Int      | 否         | -        | 逻辑约束：1–5                                           | 星级评分（1–5 分）                       |
| createdAt | DateTime | 否         | `now()`  | 唯一复合键：`(bookId, userId)`                          | 记录创建时间（同一用户一本书仅一条评分） |

## Hold 表

| 字段名    | 字段类型 | 是否可为空 | 默认值    | 完整性约束                                              | 注释                                                                            |
| --------- | -------- | ---------- | --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| id        | String   | 否         | `cuid()`  | primary key                                             | 预约记录唯一标识                                                                |
| bookId    | String   | 否         | -         | 外键：引用 `Book(id)`，删除 Book 时级联删除 (`Cascade`) | 预约图书 ID                                                                     |
| userId    | String   | 否         | -         | 外键：引用 `User(id)`，删除 User 时级联删除 (`Cascade`) | 预约用户 ID                                                                     |
| status    | Enum     | 否         | `WAITING` | 枚举：`WAITING` / `READY` / `FULFILLED` / `CANCELLED`   | 预约状态（当用户预约后成功借阅该书时，对应记录自动从 `READY` 变为 `FULFILLED`） |
| createdAt | DateTime | 否         | `now()`   | -                                                       | 记录创建时间                                                                    |

## Wishlist 表

| 字段名    | 字段类型 | 是否可为空 | 默认值   | 完整性约束                                              | 注释                                                   |
| --------- | -------- | ---------- | -------- | ------------------------------------------------------- | ------------------------------------------------------ |
| id        | String   | 否         | `cuid()` | primary key                                             | 心愿单记录唯一标识                                     |
| bookId    | String   | 否         | -        | 外键：引用 `Book(id)`，删除 Book 时级联删除 (`Cascade`) | 心愿图书 ID                                            |
| userId    | String   | 否         | -        | 外键：引用 `User(id)`，删除 User 时级联删除 (`Cascade`) | 心愿用户 ID                                            |
| createdAt | DateTime | 否         | `now()`  | 唯一复合键：`(userId, bookId)`                          | 记录创建时间；保证同一读者不能重复将同一本书加入心愿单 |

## Config 表

| 字段名 | 字段类型 | 是否可为空 | 默认值   | 完整性约束  | 注释           |
| ------ | -------- | ---------- | -------- | ----------- | -------------- |
| id     | String   | 否         | `cuid()` | primary key | 配置项唯一标识 |
| key    | String   | 否         | -        | unique      | 配置键         |
| value  | String   | 否         | -        | -           | 配置值         |

## AuditLog 表

| 字段名    | 字段类型 | 是否可为空 | 默认值   | 完整性约束                                          | 注释                           |
| --------- | -------- | ---------- | -------- | --------------------------------------------------- | ------------------------------ |
| id        | String   | 否         | `cuid()` | primary key                                         | 审计日志唯一标识               |
| userId    | String   | 是         | -        | 外键：引用 `User(id)`，删除 User 时置空 (`SetNull`) | 触发操作的用户 ID，可为空      |
| action    | String   | 否         | -        | -                                                   | 行为描述（操作类型）           |
| entity    | String   | 否         | -        | -                                                   | 被操作实体类型（如 User/Book） |
| entityId  | String   | 是         | -        | -                                                   | 被操作实体主键 ID，可为空      |
| detail    | String   | 是         | -        | -                                                   | 详细描述/附加信息              |
| createdAt | DateTime | 否         | `now()`  | -                                                   | 日志创建时间                   |

---

## Announcement 表（新增，支撑 Backlog 3.1 系统公告）

用于闭馆通知、活动信息、借阅规则变化等公告。

| 字段名      | 字段类型 | 是否可为空 | 默认值   | 完整性约束  | 注释                   |
| ----------- | -------- | ---------- | -------- | ----------- | ---------------------- |
| id          | String   | 否         | `cuid()` | primary key | 公告唯一标识           |
| title       | String   | 否         | -        | -           | 公告标题               |
| content     | String   | 否         | -        | -           | 公告正文               |
| publishedAt | DateTime | 是         | -        | -           | 发布时间（未发布为空） |
| createdAt   | DateTime | 否         | `now()`  | -           | 记录创建时间           |

## AcquisitionRequest 表（新增，支撑 Backlog 3.2 资源荐购）

| 字段名    | 字段类型 | 是否可为空 | 默认值    | 完整性约束                                    | 注释                                   |
| --------- | -------- | ---------- | --------- | --------------------------------------------- | -------------------------------------- |
| id        | String   | 否         | `cuid()`  | primary key                                   | 荐购记录唯一标识                       |
| userId    | String   | 否         | -         | 外键：引用 `User(id)`，删除 User 时级联或置空 | 荐购人 ID                              |
| title     | String   | 否         | -         | -                                             | 建议书名                               |
| author    | String   | 否         | -         | -                                             | 建议作者                               |
| isbn      | String   | 是         | -         | -                                             | 建议 ISBN（如有）                      |
| reason    | String   | 是         | -         | -                                             | 荐购理由/备注                          |
| status    | String   | 否         | `PENDING` | -                                             | 处理状态：PENDING/ACCEPTED/REJECTED 等 |
| createdAt | DateTime | 否         | `now()`   | -                                             | 提交时间                               |

---

## 数据库构建方法：

1. 进入后端目录：

```
cd library-management-system\backend
```

2. 删除旧数据库文件

```
Remove-Item .\dev.db
```

如果提示文件不存在，可以忽略。

3. 根据当前 schema.prisma 重新生成 SQLite 数据库结构

```
.\node_modules\.bin\prisma.cmd db push --schema .\prisma\schema.prisma
```

4. 重新生成 Prisma Client

```
.\node_modules\.bin\prisma.cmd generate --schema .\prisma\schema.prisma
```

5. 执行 seed，插入初始数据

```
node .\prisma\seed.js
```

6. 综合执行以上步骤的 PowerShell 脚本：

```powershell
cd library-management-system\backend
Remove-Item .\dev.db -ErrorAction Ignore
.\node_modules\.bin\prisma.cmd db push --schema .\prisma\schema.prisma
.\node_modules\.bin\prisma.cmd generate --schema .\prisma\schema.prisma
node .\prisma\seed.js
```
