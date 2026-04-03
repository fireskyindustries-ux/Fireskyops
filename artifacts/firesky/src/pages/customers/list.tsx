import { useState } from "react";
import { useListCustomers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Search, MapPin, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  
  const { data: customers, isLoading, error } = useListCustomers({ search: debouncedSearch || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage farms and client contacts</p>
        </div>
        <Link href="/customers/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" /> Add Customer
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search by name, farm, or town..." 
          className="pl-10 h-12 text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-destructive">Failed to load customers</div>
      ) : customers?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No customers found.</p>
          {search && <p className="mt-1">Try adjusting your search.</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers?.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1">{customer.name}</h3>
                    {customer.farmName && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{customer.farmName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {(customer.nearestTown || customer.province) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">
                          {[customer.nearestTown, customer.province].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}