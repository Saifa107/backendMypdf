# ========================
# Stage 1: Build
# ========================
FROM node:20-alpine AS build
WORKDIR /app

# ลงของ
COPY package.json package-lock.json ./
RUN npm ci

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# แปลงภาษา (ts -> js) ลงโฟลเดอร์ dist
# (ถ้าไม่มีไฟล์ tsconfig.json เพื่อนต้องสร้างด้วยนะ)
RUN npx tsc

# ========================
# Stage 2: Run
# ========================
FROM node:20-alpine
WORKDIR /app

ENV port=3000
ENV NODE_ENV=production

# เอาไลบรารี่และไฟล์ที่แปลเสร็จแล้วมาใช้
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist

# สร้างโฟลเดอร์ uploads รอไว้
RUN mkdir -p ./uploads && chmod 777 ./uploads

EXPOSE 3000

# รันไฟล์ที่แปลเสร็จแล้ว
CMD ["node", "dist/server.js"]