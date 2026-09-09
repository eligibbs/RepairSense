import type { NextRequest } from "next/server";
import { AssetDisposition, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId")?.trim() ?? "";
  if (!query || !customerId) return Response.json([]);

  const assets = await prisma.asset.findMany({
    where: {
      customerId,
      disposition: AssetDisposition.ACTIVE,
      repairIntakes: { none: { status: { notIn: [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED] } } },
      OR: [
        { serialNumber: { contains: query } },
        { assetTag: { contains: query } },
        { rawModel: { contains: query } },
        { family: { contains: query } },
      ],
    },
    include: { location: true },
    orderBy: [{ family: "asc" }, { serialNumber: "asc" }],
    take: 25,
  });

  return Response.json(assets.map((asset) => ({
    id: asset.id,
    name: asset.rawModel ?? `${asset.brand} ${asset.family ?? ""}`.trim(),
    serialNumber: asset.serialNumber,
    assetTag: asset.assetTag,
    location: asset.location?.code ?? null,
  })));
}
