import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Search, Building2, Users, Handshake } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  partnered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  declined: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUSES = ["new", "contacted", "partnered", "declined"];

const AdminBusinessPortal = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const queryClient = useQueryClient();

  const { data: wholesale = [], isLoading: wLoad } = useQuery({
    queryKey: ["admin-wholesale"],
    queryFn: async () => {
      const { data } = await supabase.from("wholesale_inquiries").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: affiliates = [], isLoading: aLoad } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: async () => {
      const { data } = await supabase.from("affiliate_applications").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: partnerships = [], isLoading: pLoad } = useQuery({
    queryKey: ["admin-partnerships"],
    queryFn: async () => {
      const { data } = await supabase.from("partnership_proposals").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ table, id, status }: { table: string; id: string; status: string }) => {
      const { error } = await supabase.from(table as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wholesale"] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-partnerships"] });
      toast.success("Status updated");
    },
  });

  const filter = <T extends { created_at: string }>(items: T[], searchFields: (keyof T)[]) => {
    let filtered = items;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item => searchFields.some(f => String(item[f] || "").toLowerCase().includes(q)));
    }
    return sortBy === "oldest" ? [...filtered].reverse() : filtered;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search submissions..." className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="wholesale">
        <TabsList>
          <TabsTrigger value="wholesale" className="gap-2"><Building2 className="w-4 h-4" />Wholesale ({wholesale.length})</TabsTrigger>
          <TabsTrigger value="affiliate" className="gap-2"><Users className="w-4 h-4" />Affiliates ({affiliates.length})</TabsTrigger>
          <TabsTrigger value="partnership" className="gap-2"><Handshake className="w-4 h-4" />Partnerships ({partnerships.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wLoad ? <LoadingRow cols={6} /> : filter(wholesale, ["company_name", "contact_email"]).map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.company_name}</TableCell>
                    <TableCell>{w.contact_email}</TableCell>
                    <TableCell className="capitalize">{w.sales_channels}</TableCell>
                    <TableCell>{w.monthly_order_volume}</TableCell>
                    <TableCell>{format(new Date(w.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusSelect value={w.status} onChange={s => updateStatus.mutate({ table: "wholesale_inquiries", id: w.id, status: s })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="affiliate" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aLoad ? <LoadingRow cols={6} /> : filter(affiliates, ["full_name", "email", "primary_niche"]).map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell className="capitalize">{a.primary_niche}</TableCell>
                    <TableCell>{a.follower_count}</TableCell>
                    <TableCell>{format(new Date(a.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusSelect value={a.status} onChange={s => updateStatus.mutate({ table: "affiliate_applications", id: a.id, status: s })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="partnership" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representative</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Goals</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pLoad ? <LoadingRow cols={6} /> : filter(partnerships, ["representative_name", "email", "company_industry"]).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.representative_name}<br /><span className="text-xs text-muted-foreground">{p.job_title}</span></TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell className="capitalize">{p.company_industry}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{(p.strategic_goals || []).map((g: string) => <Badge key={g} variant="outline" className="text-xs">{g}</Badge>)}</div></TableCell>
                    <TableCell>{format(new Date(p.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusSelect value={p.status} onChange={s => updateStatus.mutate({ table: "partnership_proposals", id: p.id, status: s })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatusSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-[130px] h-8">
      <Badge variant="outline" className={`${STATUS_COLORS[value] || ""} border`}>{value}</Badge>
    </SelectTrigger>
    <SelectContent>
      {STATUSES.map(s => (
        <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const LoadingRow = ({ cols }: { cols: number }) => (
  <TableRow><TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
);

export default AdminBusinessPortal;
